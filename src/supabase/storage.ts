/**
 * Supabase Storage 헬퍼 (설계서 7.4)
 *
 * 버킷:
 *  - outlines: 도안 (CacheFirst)
 *  - artworks: 완성작 (NetworkFirst)
 *  - thumbnails: 썸네일 (StaleWhileRevalidate)
 */

import { supabase } from './client';

export type Bucket = 'outlines' | 'artworks' | 'thumbnails';

export async function uploadBlob(bucket: Bucket, path: string, blob: Blob): Promise<void> {
  const { error } = await supabase.storage.from(bucket).upload(path, blob, {
    upsert: true,
    contentType: blob.type || 'image/png',
  });
  if (error) throw error;
}

export function publicUrl(bucket: Bucket, path: string): string {
  const { data } = supabase.storage.from(bucket).getPublicUrl(path);
  return data.publicUrl;
}

export async function downloadBlob(bucket: Bucket, path: string): Promise<Blob> {
  const { data, error } = await supabase.storage.from(bucket).download(path);
  if (error) throw error;
  return data;
}
