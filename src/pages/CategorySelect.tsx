import { Link } from 'react-router-dom';
import { useAsyncData } from '@/hooks/useAsyncData';
import { AsyncBoundary } from '@/components/AsyncBoundary';
import { listCategories } from '@/supabase/categories';

export default function CategorySelect() {
  const state = useAsyncData(listCategories, []);

  return (
    <div className="min-h-full p-6">
      <Link to="/" className="kid-btn bg-white px-6 inline-flex items-center">
        🏠 홈
      </Link>
      <h1 className="text-kid-title mt-6 text-center">어떤 그림 그릴까?</h1>

      <AsyncBoundary state={state} loadingLabel="카테고리 가져오는 중...">
        {(categories) => (
          <div className="mt-8 grid grid-cols-2 sm:grid-cols-3 gap-6 max-w-3xl mx-auto">
            {categories.map((c) => (
              <Link
                key={c.id}
                to={`/categories/${c.id}`}
                className="kid-btn bg-white aspect-square flex flex-col items-center justify-center gap-3 p-4"
              >
                <div className="text-7xl">{c.icon_emoji ?? '🎨'}</div>
                <div className="text-kid-btn">{c.name}</div>
              </Link>
            ))}
          </div>
        )}
      </AsyncBoundary>
    </div>
  );
}
