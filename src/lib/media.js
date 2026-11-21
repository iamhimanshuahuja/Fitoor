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
export function useSignedUrl(path) {
  const [url, setUrl] = useState(cache.get(path)?.url || null);
  useEffect(() => {
    if (!path) return setUrl(null);
    const hit = cache.get(path);
    if (hit && hit.exp > Date.now()) return setUrl(hit.url);
    let alive = true;
    supabase.storage.from('media').createSignedUrl(path, 3600).then(({ data }) => {
      if (!alive || !data) return;
      cache.set(path, { url: data.signedUrl, exp: Date.now() + 3500e3 });
      setUrl(data.signedUrl);
    });
    return () => { alive = false; };
  }, [path]);
  return url;
}
