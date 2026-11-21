import { useEffect, useState } from 'react';
import { Alert } from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import * as DocumentPicker from 'expo-document-picker';
import { ImageManipulator, SaveFormat } from 'expo-image-manipulator';
import { File } from 'expo-file-system';
import { decode, encode } from 'base64-arraybuffer';
import { supabase } from './supabase';

/**
 * Pick a photo from the camera or gallery and shrink it to ~1280 px JPEG (same budget as the web app's WebP).
 * Returns { uri, base64, mime, width, height } or null if cancelled.
 */
export async function pickImage(source = 'library', { max = 1280 } = {}) {
  try {
    // The gallery picker needs no permission on iOS 14+ / Android 13+; only the camera does.
    if (source === 'camera') {
      const perm = await ImagePicker.requestCameraPermissionsAsync();
      if (!perm.granted) { Alert.alert('Camera access needed', 'Allow camera access for Fitoor in Settings, or pick a photo from your gallery.'); return null; }
    }
    const opts = { mediaTypes: ['images'], quality: 1 };
    const res = source === 'camera' ? await ImagePicker.launchCameraAsync(opts) : await ImagePicker.launchImageLibraryAsync(opts);
    if (res.canceled || !res.assets?.length) return null;
    return await compress(res.assets[0], max);
  } catch (e) {
    Alert.alert(source === 'camera' ? 'Camera not available' : 'Couldn’t open photos', e?.message || 'Please try again.');
    return null;
  }
}

export async function compress(asset, max = 1280) {
  const ctx = ImageManipulator.manipulate(asset.uri);
  const w = asset.width || 0, h = asset.height || 0;
  if (w >= h && w > max) ctx.resize({ width: max });
  else if (h > w && h > max) ctx.resize({ height: max });
  const img = await ctx.renderAsync();
  const out = await img.saveAsync({ compress: 0.7, format: SaveFormat.JPEG, base64: true });
  return { uri: out.uri, base64: out.base64, mime: 'image/jpeg', width: out.width, height: out.height };
}

const rand = () => Math.random().toString(36).slice(2, 8);

/** Upload a picked/compressed image to the private 'media' bucket: <uid>/<folder>/<file>.jpg */
export async function uploadMedia(userId, folder, img) {
  const path = `${userId}/${folder}/${Date.now()}-${rand()}.jpg`;
  const { error } = await supabase.storage.from('media').upload(path, decode(img.base64), { contentType: 'image/jpeg', upsert: false });
  if (error) throw error;
  return path;
}

/** Upload to a public bucket (recipes): <uid>/<file>.jpg — returns the storage path. */
export async function uploadPublic(bucket, userId, img) {
  const path = `${userId}/${Date.now()}-${rand()}.jpg`;
  const { error } = await supabase.storage.from(bucket).upload(path, decode(img.base64), { contentType: 'image/jpeg', upsert: false });
  if (error) throw error;
  return path;
}

/** Pick a PDF or image for lab reports. Returns { uri, name, mime, size, base64, bytes } or null. */
export async function pickDocument({ maxBytes = 4 * 1024 * 1024 } = {}) {
  const res = await DocumentPicker.getDocumentAsync({ type: ['application/pdf', 'image/*'], copyToCacheDirectory: true });
  if (res.canceled || !res.assets?.length) return null;
  const a = res.assets[0];
  if (a.size && a.size > maxBytes) { Alert.alert('File too big', 'Please pick a file under 4 MB (or a clear photo of the report).'); return null; }
  const bytes = await new File(a.uri).arrayBuffer();
  return { uri: a.uri, name: a.name, mime: a.mimeType || 'application/pdf', size: a.size, bytes, base64: encode(bytes) };
}

export async function uploadFile(userId, folder, doc) {
  const ext = (doc.name?.split('.').pop() || (doc.mime === 'application/pdf' ? 'pdf' : 'jpg')).toLowerCase();
  const path = `${userId}/${folder}/${Date.now()}-${rand()}.${ext}`;
  const { error } = await supabase.storage.from('media').upload(path, doc.bytes, { contentType: doc.mime, upsert: false });
  if (error) throw error;
  return path;
}

const cache = new Map();
/** Signed URL for a private object (bucket 'media' by default, 'avatars' for profile photos). Cached ~50 min. */
export function useSignedUrl(path, bucket = 'media') {
  const key = `${bucket}/${path}`;
  const [url, setUrl] = useState(cache.get(key)?.url || null);
  useEffect(() => {
    if (!path) { setUrl(null); return; }
    const c = cache.get(key);
    if (c && c.exp > Date.now()) { setUrl(c.url); return; }
    let live = true;
    supabase.storage.from(bucket).createSignedUrl(path, 3600).then(({ data }) => {
      if (!live || !data?.signedUrl) return;
      cache.set(key, { url: data.signedUrl, exp: Date.now() + 50 * 60 * 1000 }); setUrl(data.signedUrl);
    });
    return () => { live = false; };
  }, [path, bucket, key]);
  return url;
}

/** Pick a photo, centre-crop it square (512 px JPEG) and make it the user's profile photo. Returns the new path or null. */
export async function pickAvatar(userId, oldPath, source = 'library') {
  try {
    if (source === 'camera') {
      const perm = await ImagePicker.requestCameraPermissionsAsync();
      if (!perm.granted) { Alert.alert('Camera access needed', 'Allow camera access for Fitoor in Settings, or pick from your gallery.'); return null; }
    }
    const opts = { mediaTypes: ['images'], quality: 1, allowsEditing: true, aspect: [1, 1], ...(source === 'camera' ? { cameraType: ImagePicker.CameraType.front } : {}) };
    const res = source === 'camera' ? await ImagePicker.launchCameraAsync(opts) : await ImagePicker.launchImageLibraryAsync(opts);
    if (res.canceled || !res.assets?.length) return null;
    const a = res.assets[0];
    const side = Math.min(a.width, a.height);
    const ctx = ImageManipulator.manipulate(a.uri);
    if (a.width !== a.height) ctx.crop({ originX: (a.width - side) / 2, originY: (a.height - side) / 2, width: side, height: side });
    ctx.resize({ width: 512, height: 512 });
    const out = await (await ctx.renderAsync()).saveAsync({ compress: 0.8, format: SaveFormat.JPEG, base64: true });
    const path = `${userId}/${Date.now()}-${rand()}.jpg`;
    const up = await supabase.storage.from('avatars').upload(path, decode(out.base64), { contentType: 'image/jpeg', upsert: false });
    if (up.error) throw up.error;
    const { error } = await supabase.from('profiles').update({ avatar_path: path }).eq('id', userId);
    if (error) { await supabase.storage.from('avatars').remove([path]); throw error; }
    if (oldPath) supabase.storage.from('avatars').remove([oldPath]);
    return path;
  } catch (e) {
    Alert.alert('Photo not saved', e?.message || 'Please try again.');
    return null;
  }
}

export async function removeAvatar(userId, oldPath) {
  const { error } = await supabase.from('profiles').update({ avatar_path: null }).eq('id', userId);
  if (error) { Alert.alert('Not removed', error.message); return false; }
  if (oldPath) await supabase.storage.from('avatars').remove([oldPath]);
  return true;
}
export const publicUrl = (bucket, path) => (path ? supabase.storage.from(bucket).getPublicUrl(path).data.publicUrl : null);
