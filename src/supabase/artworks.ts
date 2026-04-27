/**
 * 작품 CRUD (설계서 7.2, 7.5)
 *
 * 삭제 시 Storage 객체와 DB row를 순서대로 정리.
 */

import { supabase } from './client';
import type { Artwork } from './types';

export async function listArtworks(): Promise<Artwork[]> {
  const { data, error } = await supabase
    .from('artworks')
    .select('*')
    .order('created_at', { ascending: false });
  if (error) throw error;
  return data ?? [];
}

export async function getArtworkById(id: string): Promise<Artwork | null> {
  const { data, error } = await supabase
    .from('artworks')
    .select('*')
    .eq('id', id)
    .maybeSingle();
  if (error) throw error;
  return data;
}

export async function insertArtwork(
  pageId: string | null,
  imagePath: string,
  thumbnailPath: string | null,
): Promise<Artwork> {
  const { data, error } = await supabase
    .from('artworks')
    .insert({ page_id: pageId, image_path: imagePath, thumbnail_path: thumbnailPath })
    .select()
    .single();
  if (error) throw error;
  return data as Artwork;
}

export async function deleteArtwork(artwork: Artwork): Promise<void> {
  // 1) Storage 객체 삭제 (실패해도 진행 — orphan보단 row 삭제가 우선)
  await supabase.storage.from('artworks').remove([artwork.image_path]).catch(() => {});
  if (artwork.thumbnail_path) {
    await supabase.storage.from('thumbnails').remove([artwork.thumbnail_path]).catch(() => {});
  }
  // 2) DB row 삭제
  const { error } = await supabase.from('artworks').delete().eq('id', artwork.id);
  if (error) throw error;
}
