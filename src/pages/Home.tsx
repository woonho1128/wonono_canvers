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
    <div className="min-h-full p-6 bg-app-bg flex flex-col items-center justify-center gap-6 relative">
      <button
        type="button"
        aria-label={soundEnabled ? '음소거 켜기' : '음소거 끄기'}
        onClick={onMuteToggle}
        className="absolute top-4 right-4 w-touch-lg h-touch-lg rounded-full bg-white text-3xl shadow-sm ring-2 ring-black/10"
      >
        {soundEnabled ? '🔊' : '🔇'}
      </button>

      <h1 className="text-kid-title">조카 색칠놀이</h1>

      <div className="flex flex-wrap gap-6 justify-center">
        <Link
          to="/categories"
          onClick={onMenuTap}
          className="kid-btn bg-app-orange text-white w-menu h-menu flex items-center justify-center"
        >
          🎨 색칠하기
        </Link>
        <Link
          to="/gallery"
          onClick={onMenuTap}
          className="kid-btn bg-app-mint text-white w-menu h-menu flex items-center justify-center"
        >
          🖼️ 그림 보기
        </Link>
        <Link
          to="/parent"
          onClick={onMenuTap}
          className="kid-btn bg-app-text text-white w-menu h-menu flex items-center justify-center"
        >
          👤 어른
        </Link>
      </div>
    </div>
  );
}
