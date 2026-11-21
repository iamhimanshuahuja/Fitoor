import imageCompression from 'browser-image-compression';
import { useEffect, useState } from 'react';
import { supabase } from './supabase';

// Mid-quality storage: ~1280px WebP, target ≤ 200 KB
export async function compressImage(file) {
  if (!file.type.startsWith('image/')) return file;
  return imageCompression(file, {
    maxWidthOrHeight: 1280,
    maxSizeMB: 0.2,
    initialQuality: 0.7,
    fileType: 'image/webp',
    useWebWorker: true,
  });
}

// Upload to private bucket 'media' under <userId>/<folder>/...
export async function uploadMedia(userId, folder, file, { compress = true } = {}) {
  const body = compress ? await compressImage(file) : file;
  const ext = body.type === 'image/webp' ? 'webp' : (file.name.split('.').pop() || 'bin');
  const path = `${userId}/${folder}/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;
  const { error } = await supabase.storage.from('media').upload(path, body, { contentType: body.type, upsert: false });
  if (error) throw error;
  return { path, file: body };
}

// Base64 (no data: prefix) for sending to the AI function
export const toBase64 = (blob) =>
  new Promise((res, rej) => {
    const r = new FileReader();
    r.onload = () => res(String(r.result).split(',')[1]);
    r.onerror = rej;
    r.readAsDataURL(blob);
  });

const cache = new Map();
/** Signed URL for a private object (default bucket 'media'; 'avatars' for profile photos). Cached ~1 h. */
export function useSignedUrl(path, bucket = 'media') {
  const key = `${bucket}/${path}`;
  const [url, setUrl] = useState(cache.get(key)?.url || null);
  useEffect(() => {
    if (!path) return setUrl(null);
    const hit = cache.get(key);
    if (hit && hit.exp > Date.now()) return setUrl(hit.url);
    let alive = true;
    supabase.storage.from(bucket).createSignedUrl(path, 3600).then(({ data }) => {
      if (!alive || !data) return;
      cache.set(key, { url: data.signedUrl, exp: Date.now() + 3500e3 });
      setUrl(data.signedUrl);
    });
    return () => { alive = false; };
  }, [path, bucket, key]);
  return url;
}

/** Centre-crop an image file to a square and export a small WebP (profile photos). */
export async function squareWebp(file, size = 512) {
  const bmp = await createImageBitmap(file);
  const s = Math.min(bmp.width, bmp.height);
  const c = document.createElement('canvas'); c.width = size; c.height = size;
  c.getContext('2d').drawImage(bmp, (bmp.width - s) / 2, (bmp.height - s) / 2, s, s, 0, 0, size, size);
  bmp.close?.();
  return new Promise((res, rej) => c.toBlob((b) => (b ? res(b) : rej(new Error('Could not read that photo'))), 'image/webp', 0.82));
}

/** Upload a new profile photo for the signed-in user, point profiles.avatar_path at it and remove the old one. */
export async function setAvatar(userId, file, oldPath) {
  if (!file.type.startsWith('image/')) throw new Error('Please pick a photo');
  const body = await squareWebp(file);
  const path = `${userId}/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.webp`;
  const up = await supabase.storage.from('avatars').upload(path, body, { contentType: 'image/webp', upsert: false });
  if (up.error) throw up.error;
  const { error } = await supabase.from('profiles').update({ avatar_path: path }).eq('id', userId);
  if (error) { await supabase.storage.from('avatars').remove([path]); throw error; }
  if (oldPath) supabase.storage.from('avatars').remove([oldPath]);
  return path;
}

export async function removeAvatar(userId, oldPath) {
  const { error } = await supabase.from('profiles').update({ avatar_path: null }).eq('id', userId);
  if (error) throw error;
  if (oldPath) await supabase.storage.from('avatars').remove([oldPath]);
}
