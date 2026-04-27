import { Link, useParams } from 'react-router-dom';
import { useAsyncData } from '@/hooks/useAsyncData';
import { AsyncBoundary } from '@/components/AsyncBoundary';
import { listPages } from '@/supabase/pages';
import { publicUrl } from '@/supabase/storage';
import { listDrafts } from '@/db/drafts';
import type { ColoringPage } from '@/supabase/types';

export default function PageGrid() {
  const { categoryId } = useParams<{ categoryId: string }>();
  const state = useAsyncData(async () => {
    const [pages, drafts] = await Promise.all([
      listPages(categoryId),
      listDrafts().catch(() => []),
    ]);
    const draftIds = new Set(drafts.map((d) => d.pageId));
    return { pages, draftIds };
  }, [categoryId]);

  return (
    <div className="min-h-full p-6">
      <Link to="/categories" className="kid-btn bg-white px-6 inline-flex items-center">
        ⬅️ 카테고리
      </Link>

      <AsyncBoundary state={state} loadingLabel="도안 가져오는 중...">
        {({ pages, draftIds }) => {
          if (pages.length === 0) return <EmptyState />;
          // 이어 그릴 도안을 앞으로
          const sorted = [...pages].sort((a, b) => {
            const ad = draftIds.has(a.id) ? 0 : 1;
            const bd = draftIds.has(b.id) ? 0 : 1;
            return ad - bd;
          });
          return (
            <div className="mt-8 grid grid-cols-2 sm:grid-cols-3 gap-6 max-w-4xl mx-auto">
              {sorted.map((p) => (
                <PageCard key={p.id} page={p} hasDraft={draftIds.has(p.id)} />
              ))}
            </div>
          );
        }}
      </AsyncBoundary>
    </div>
  );
}

function PageCard({ page, hasDraft }: { page: ColoringPage; hasDraft: boolean }) {
  const thumbnailSrc = page.thumbnail_path
    ? publicUrl('thumbnails', page.thumbnail_path)
    : publicUrl('outlines', page.outline_path);

  return (
    <Link
      to={`/color/${page.id}`}
      className="relative kid-btn bg-white aspect-square flex items-center justify-center p-4 overflow-hidden"
    >
      <img
        src={thumbnailSrc}
        alt={page.title ?? '도안'}
        className="max-w-full max-h-full object-contain"
        loading="lazy"
      />
      {hasDraft && (
        <span
          aria-label="이어 그리기"
          className="absolute top-2 right-2 bg-app-orange text-white text-sm font-bold px-3 py-1 rounded-full shadow-md"
        >
          이어 그리기 ✨
        </span>
      )}
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
