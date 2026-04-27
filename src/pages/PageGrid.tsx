import { Link, useParams } from 'react-router-dom';
import { useAsyncData } from '@/hooks/useAsyncData';
import { AsyncBoundary } from '@/components/AsyncBoundary';
import { listPages } from '@/supabase/pages';
import { publicUrl } from '@/supabase/storage';
import type { ColoringPage } from '@/supabase/types';

export default function PageGrid() {
  const { categoryId } = useParams<{ categoryId: string }>();
  const state = useAsyncData(() => listPages(categoryId), [categoryId]);

  return (
    <div className="min-h-full p-6">
      <Link to="/categories" className="kid-btn bg-white px-6 inline-flex items-center">
        ⬅️ 카테고리
      </Link>

      <AsyncBoundary state={state} loadingLabel="도안 가져오는 중...">
        {(pages) =>
          pages.length === 0 ? (
            <EmptyState />
          ) : (
            <div className="mt-8 grid grid-cols-2 sm:grid-cols-3 gap-6 max-w-4xl mx-auto">
              {pages.map((p) => (
                <PageCard key={p.id} page={p} />
              ))}
            </div>
          )
        }
      </AsyncBoundary>
    </div>
  );
}

function PageCard({ page }: { page: ColoringPage }) {
  // 썸네일이 따로 없으면 외곽선 SVG를 그대로 표시
  const thumbnailSrc = page.thumbnail_path
    ? publicUrl('thumbnails', page.thumbnail_path)
    : publicUrl('outlines', page.outline_path);

  return (
    <Link
      to={`/color/${page.id}`}
      className="kid-btn bg-white aspect-square flex items-center justify-center p-4 overflow-hidden"
    >
      <img
        src={thumbnailSrc}
        alt={page.title ?? '도안'}
        className="max-w-full max-h-full object-contain"
        loading="lazy"
      />
    </Link>
  );
}

function EmptyState() {
  return (
    <div className="text-center mt-16">
      <div className="text-7xl">🎨</div>
      <p className="text-kid-body mt-4">아직 도안이 없어요</p>
      <p className="text-sm text-app-text/60 mt-2">어른에게 부탁하기</p>
    </div>
  );
}
