/**
 * Supabase 테이블 타입 (설계서 7.2)
 *
 * 추후 supabase gen types typescript로 자동 생성 가능하지만
 * 지금은 수동 정의 (스키마 변경 적을 예정).
 */

export interface Category {
  id: string;
  name: string;
  icon_emoji: string | null;
  sort_order: number;
  created_at: string;
}

export interface ColoringPage {
  id: string;
  category_id: string | null;
  title: string | null;
  outline_path: string;
  thumbnail_path: string | null;
  source: 'default' | 'user_upload';
  is_hidden: boolean;
  created_at: string;
}

export interface Artwork {
  id: string;
  page_id: string | null;
  image_path: string;
  thumbnail_path: string | null;
  created_at: string;
}
