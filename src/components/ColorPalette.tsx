import clsx from 'clsx';
import { useEffect, useRef, useState } from 'react';
import { PAINT_COLORS, type PaintColor } from './paintColors';

interface Props {
  value: string; // hex
  onChange: (color: PaintColor) => void;
}

/**
 * 색 팔레트 — 기본 12색 + 사용자 정의 색.
 * 마지막에 🎨 버튼 누르면 OS 컬러 피커가 뜨고,
 * 고른 색이 팔레트 끝에 추가됨(최근 4개까지 유지). 새로 고른 색은 자동 활성.
 */
const RECENT_LIMIT = 4;

export function ColorPalette({ value, onChange }: Props) {
  const [recent, setRecent] = useState<string[]>([]);
  const inputRef = useRef<HTMLInputElement>(null);
  const [draftColor, setDraftColor] = useState('#FF9F45');

  // 처음 마운트 때 localStorage에서 최근 색 복원
  useEffect(() => {
    try {
      const raw = localStorage.getItem('paint.recent');
      if (raw) {
        const arr = JSON.parse(raw) as unknown;
        if (Array.isArray(arr)) setRecent(arr.filter((s) => typeof s === 'string').slice(0, RECENT_LIMIT));
      }
    } catch {
      /* ignore */
    }
  }, []);

  const persistRecent = (next: string[]) => {
    setRecent(next);
    try {
      localStorage.setItem('paint.recent', JSON.stringify(next));
    } catch {
      /* ignore */
    }
  };

  const handleCustomChange = (hex: string) => {
    const upper = hex.toUpperCase();
    const next = [upper, ...recent.filter((c) => c.toUpperCase() !== upper)].slice(0, RECENT_LIMIT);
    persistRecent(next);
    onChange({ name: 'custom', hex: upper, cls: '' });
  };

  return (
    <div className="flex items-center gap-2 px-4 overflow-x-auto h-touch-lg">
      {PAINT_COLORS.map((c) => {
        const selected = value.toUpperCase() === c.hex.toUpperCase();
        return (
          <button
            key={c.name}
            type="button"
            aria-label={`${c.name} 색`}
            aria-pressed={selected}
            onPointerDown={(e) => e.preventDefault()}
            onClick={() => onChange(c)}
            className={clsx(
              'shrink-0 rounded-full transition-transform duration-100',
              c.cls,
              selected
                ? 'w-16 h-16 ring-4 ring-app-text/80 scale-110'
                : 'w-14 h-14 ring-2 ring-black/10',
            )}
          />
        );
      })}

      {/* 최근 사용한 사용자 정의 색 */}
      {recent.map((hex) => {
        const selected = value.toUpperCase() === hex.toUpperCase();
        return (
          <button
            key={`recent-${hex}`}
            type="button"
            aria-label={`사용자 색 ${hex}`}
            aria-pressed={selected}
            onPointerDown={(e) => e.preventDefault()}
            onClick={() => onChange({ name: 'custom', hex, cls: '' })}
            className={clsx(
              'shrink-0 rounded-full transition-transform duration-100',
              selected
                ? 'w-16 h-16 ring-4 ring-app-text/80 scale-110'
                : 'w-14 h-14 ring-2 ring-black/10',
            )}
            style={{ backgroundColor: hex }}
          />
        );
      })}

      {/* 사용자 정의 색 추가 버튼 */}
      <button
        type="button"
        aria-label="색 직접 고르기"
        onPointerDown={(e) => e.preventDefault()}
        onClick={() => inputRef.current?.click()}
        className="shrink-0 w-14 h-14 rounded-full ring-2 ring-black/10 bg-white flex items-center justify-center text-2xl"
        style={{
          background:
            'conic-gradient(from 180deg, #FF6B6B, #FFD93D, #6BCB77, #5EB3F7, #B57BE8, #FF8AA8, #FF6B6B)',
        }}
      >
        <span className="bg-white rounded-full w-9 h-9 flex items-center justify-center">🎨</span>
      </button>
      <input
        ref={inputRef}
        type="color"
        value={draftColor}
        onChange={(e) => {
          setDraftColor(e.target.value);
          handleCustomChange(e.target.value);
        }}
        className="sr-only"
        aria-hidden
        tabIndex={-1}
      />
    </div>
  );
}
