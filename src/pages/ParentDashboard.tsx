import { Link, useNavigate } from 'react-router-dom';
import { supabase } from '@/supabase/client';
import { useAuth } from '@/auth/AuthContext';

type MenuItem = {
  to: string;
  emoji: string;
  title: string;
  desc: string;
  accent: string;
  enabled: boolean;
};

const MENU: MenuItem[] = [
  {
    to: '/parent/photo-to-outline',
    emoji: '✨',
    title: '사진으로 도안 만들기',
    desc: '사진을 색칠 도안으로 변환',
    accent: 'bg-[#FFE680]',
    enabled: true,
  },
  {
    to: '#',
    emoji: '📋',
    title: '도안 관리',
    desc: '곧 출시 예정',
    accent: 'bg-[#B5EAD7]',
    enabled: false,
  },
  {
    to: '#',
    emoji: '🖼️',
    title: '작품 관리',
    desc: '곧 출시 예정',
    accent: 'bg-[#D4C5F9]',
    enabled: false,
  },
  {
    to: '#',
    emoji: '⚙️',
    title: '설정',
    desc: '곧 출시 예정',
    accent: 'bg-[#FFB4A2]',
    enabled: false,
  },
];

export default function ParentDashboard() {
  const nav = useNavigate();
  const { session } = useAuth();
  const username = (session?.user.email ?? '').split('@')[0] || '';

  async function handleLogout() {
    await supabase.auth.signOut();
    nav('/login', { replace: true });
  }

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
          <div className="flex items-center gap-3">
            {username && (
              <span className="font-display font-bold text-kid-ink text-sm lg:text-base">
                👤 {username}
              </span>
            )}
            <button
              type="button"
              onClick={handleLogout}
              className="kid-chunky-cream px-5 py-3 text-sm lg:text-base"
            >
              로그아웃
            </button>
          </div>
        </header>

        <h1 className="font-display font-extrabold text-3xl lg:text-4xl mt-6">
          <span className="text-kid-orange-deep">부모</span> 메뉴
        </h1>
        <p className="font-hand text-kid-ink-soft text-base mt-1">
          아이를 위한 콘텐츠를 관리해요
        </p>

        {/* 메뉴 카드 — 항상 2열, 세로 공간을 채우도록 카드 자체를 키움 */}
        <div className="mt-7 grid grid-cols-1 sm:grid-cols-2 gap-5 lg:gap-6 flex-1 content-center">
          {MENU.map((m) => (
            <MenuCard key={m.title} item={m} />
          ))}
        </div>
      </div>
    </div>
  );
}

function MenuCard({ item }: { item: MenuItem }) {
  const inner = (
    <>
      <div
        className={`${item.accent} shrink-0 w-16 h-16 lg:w-20 lg:h-20
                    rounded-[22px] grid place-items-center text-3xl lg:text-4xl`}
      >
        {item.emoji}
      </div>
      <div className="min-w-0 flex-1">
        <div className="font-display font-extrabold text-lg lg:text-xl leading-tight">
          {item.title}
        </div>
        <div className="font-hand text-sm lg:text-base text-kid-ink-soft mt-1">
          {item.desc}
        </div>
      </div>
      {item.enabled && <span className="shrink-0 text-2xl text-kid-ink-faint">›</span>}
    </>
  );

  const className = `kid-chunky kid-chunky-cream w-full text-left p-6 lg:p-7 flex items-center gap-5 min-h-[140px] lg:min-h-[160px]
                     ${item.enabled ? '' : 'opacity-60 cursor-not-allowed active:translate-y-0 active:shadow-chunky'}`;

  if (!item.enabled) {
    return (
      <div className={className} aria-disabled>
        {inner}
      </div>
    );
  }

  return (
    <Link to={item.to} className={className}>
      {inner}
    </Link>
  );
}
