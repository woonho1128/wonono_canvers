import { Link } from 'react-router-dom';
import { useAsyncData } from '@/hooks/useAsyncData';
import { AsyncBoundary } from '@/components/AsyncBoundary';
import { listCategories } from '@/supabase/categories';

// 카드 배경 파스텔 — 인덱스 기준 순환
const CARD_BG = ['bg-[#FFE8D6]', 'bg-[#B5EAD7]', 'bg-[#FFB4A2]', 'bg-[#D4C5F9]', 'bg-[#B8E0F6]', 'bg-[#FFE680]'];

export default function CategorySelect() {
  const state = useAsyncData(listCategories, []);

  return (
    <div className="min-h-screen bg-cream font-round text-kid-ink flex flex-col">
      <div className="flex-1 max-w-5xl mx-auto w-full px-6 pt-5 pb-10 lg:px-10 lg:pt-7 flex flex-col">
        {/* 헤더 */}
        <header className="flex items-center justify-between gap-3">
          <Link
            to="/"
            aria-label="홈으로"
            className="kid-chunky-cream w-tap h-tap grid place-items-center text-2xl"
          >
            🏠
          </Link>
          <div className="flex-1 text-center">
            <p className="font-hand text-base text-kid-ink-soft">안녕!</p>
            <p className="font-hand text-sm text-kid-ink-soft">오늘은 뭘 색칠할까?</p>
          </div>
          <span className="w-tap h-tap" aria-hidden />
        </header>

        <h1 className="font-display font-extrabold text-3xl lg:text-4xl text-center mt-5">
          색칠할 <span className="text-kid-orange-deep">그림</span> 골라봐!
        </h1>

        <AsyncBoundary state={state} loadingLabel="카테고리 가져오는 중...">
          {(categories) => (
            <div className="mt-8 grid grid-cols-2 sm:grid-cols-3 landscape:lg:grid-cols-4 gap-5 lg:gap-6 flex-1 content-center">
              {categories.map((c, i) => (
                <Link
                  key={c.id}
                  to={`/categories/${c.id}`}
                  className={`${CARD_BG[i % CARD_BG.length]} shadow-chunky
                              rounded-chunky aspect-square flex flex-col items-center justify-center gap-3 p-4
                              transition-all duration-75 active:translate-y-1 active:shadow-none`}
                >
                  <div className="text-6xl lg:text-7xl">{c.icon_emoji ?? '🎨'}</div>
                  <div className="font-display font-extrabold text-lg lg:text-xl text-kid-ink">
                    {c.name}
                  </div>
                </Link>
              ))}
            </div>
          )}
        </AsyncBoundary>
      </div>
    </div>
  );
}
