/**
 * 도안 CRUD (설계서 7.2)
 */

import { supabase } from './client';
import type { ColoringPage } from './types';

export async function listPages(categoryId?: string): Promise<ColoringPage[]> {
  let query = supabase.from('coloring_pages').select('*').eq('is_hidden', false);
  if (categoryId) query = query.eq('category_id', categoryId);
  const { data, error } = await query.order('created_at', { ascending: false });
  if (error) throw error;
  return data ?? [];
}

export async function insertUserPage(
  outlinePath: string,
  thumbnailPath: string | null,
  title: string | null,
  categoryId: string | null,
): Promise<ColoringPage> {
  const { data, error } = await supabase
    .from('coloring_pages')
    .insert({
      outline_path: outlinePath,
      thumbnail_path: thumbnailPath,
      title,
      category_id: categoryId,
      source: 'user_upload',
    })
    .select()
    .single();
  if (error) throw error;
  return data as ColoringPage;
}

export async function hidePage(pageId: string): Promise<void> {
  const { error } = await supabase
    .from('coloring_pages')
    .update({ is_hidden: true })
    .eq('id', pageId);
  if (error) throw error;
}
