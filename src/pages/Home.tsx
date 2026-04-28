import { Link } from 'react-router-dom';
import { useSettingsStore } from '@/store/settingsStore';
import { play, primeAudio } from '@/audio/soundEffects';

export default function Home() {
  const soundEnabled = useSettingsStore((s) => s.soundEnabled);
  const setSoundEnabled = useSettingsStore((s) => s.setSoundEnabled);

  const onMuteToggle = () => {
    primeAudio();
    setSoundEnabled(!soundEnabled);
    if (!soundEnabled) play('home');
  };

  const onMenuTap = () => {
    primeAudio();
    play('home');
  };

  return (
    <div className="min-h-screen bg-cream font-round text-kid-ink relative flex flex-col">
      {/* 우상단 음소거 토글 */}
      <button
        type="button"
        aria-label={soundEnabled ? '음소거 켜기' : '음소거 끄기'}
        onClick={onMuteToggle}
        className="absolute top-5 right-5 lg:top-7 lg:right-7
                   w-touch-lg h-touch-lg rounded-full bg-white text-3xl
                   shadow-chunky active:translate-y-1 active:shadow-none transition-all z-10"
      >
        {soundEnabled ? '🔊' : '🔇'}
      </button>

      <div className="flex-1 max-w-6xl mx-auto w-full px-6 py-10 lg:py-14
                      flex flex-col items-center justify-center gap-10 lg:gap-14">
        {/* 헤더 */}
        <div className="text-center">
          <div className="text-7xl lg:text-8xl mb-3">🦊</div>
          <p className="font-hand text-xl lg:text-2xl text-kid-ink-soft">안녕!</p>
          <h1 className="font-display font-extrabold text-4xl lg:text-6xl mt-2 leading-tight">
            오늘은 뭐 <span className="text-kid-orange-deep">색칠</span>할까?
          </h1>
        </div>

        {/* 메인 메뉴 — 가로/세로 모두 3열 */}
        <div className="w-full grid grid-cols-3 gap-5 lg:gap-7 max-w-3xl">
          <HomeCard
            to="/categories"
            onTap={onMenuTap}
            emoji="🎨"
            label="색칠하기"
            bg="bg-kid-orange"
            shadow="shadow-chunky-orange"
            text="text-white"
          />
          <HomeCard
            to="/gallery"
            onTap={onMenuTap}
            emoji="🖼️"
            label="그림 보기"
            bg="bg-kid-yellow"
            shadow="shadow-chunky-yellow"
            text="text-kid-ink"
          />
          <HomeCard
            to="/parent"
            onTap={onMenuTap}
            emoji="🔒"
            label="어른"
            bg="bg-white"
            shadow="shadow-chunky"
            text="text-kid-ink"
          />
        </div>
      </div>
    </div>
  );
}

function HomeCard({
  to,
  onTap,
  emoji,
  label,
  bg,
  shadow,
  text,
}: {
  to: string;
  onTap: () => void;
  emoji: string;
  label: string;
  bg: string;
  shadow: string;
  text: string;
}) {
  return (
    <Link
      to={to}
      onClick={onTap}
      className={`${bg} ${shadow} ${text}
                  rounded-chunky aspect-square flex flex-col items-center justify-center gap-3 lg:gap-4
                  transition-all duration-75 active:translate-y-1 active:shadow-none`}
    >
      <div className="text-6xl lg:text-7xl">{emoji}</div>
      <div className="font-display font-extrabold text-xl lg:text-2xl">{label}</div>
    </Link>
  );
}
