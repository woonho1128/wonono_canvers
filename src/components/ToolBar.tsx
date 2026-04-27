import clsx from 'clsx';
import type { ReactNode } from 'react';
import type { Tool } from '@/canvas/CanvasEngine';

interface Props {
  value: Tool;
  onChange: (tool: Tool) => void;
}

const TOOLS: { id: Tool; label: string; icon: ReactNode }[] = [
  { id: 'brush', label: '붓', icon: <BrushIcon /> },
  { id: 'fill', label: '전체 색상 칠하기', icon: <FillBucketIcon /> },
  { id: 'eraser', label: '지우개', icon: <EraserIcon /> },
];

export function ToolBar({ value, onChange }: Props) {
  return (
    <div className="flex items-center gap-2">
      {TOOLS.map((t) => {
        const selected = t.id === value;
        return (
          <button
            key={t.id}
            type="button"
            aria-label={t.label}
            aria-pressed={selected}
            onPointerDown={(e) => e.preventDefault()}
            onClick={() => onChange(t.id)}
            className={clsx(
              'shrink-0 w-touch-lg h-touch-lg rounded-2xl flex items-center justify-center transition',
              selected ? 'bg-white ring-4 ring-app-orange' : 'bg-white/60 ring-2 ring-black/10',
            )}
          >
            {t.icon}
          </button>
        );
      })}
    </div>
  );
}

function BrushIcon() {
  return (
    <svg
      aria-hidden
      viewBox="0 0 48 48"
      className="h-10 w-10"
      fill="none"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M30 6 42 18 20 40l-9 2 2-9L30 6Z" fill="#2B6CB0" stroke="#1F2937" strokeWidth="2" />
      <path d="M27 9 39 21" stroke="#93C5FD" strokeWidth="3" />
      <path d="M12 35c-4 2-5 5-5 8 4 0 7-1 9-5" fill="#FF9F43" stroke="#1F2937" strokeWidth="2" />
    </svg>
  );
}

function FillBucketIcon() {
  return (
    <svg
      aria-hidden
      viewBox="0 0 48 48"
      className="h-11 w-11"
      fill="none"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M10 31h28v7a4 4 0 0 1-4 4H14a4 4 0 0 1-4-4v-7Z" fill="#FF9F43" />
      <path d="M10 31h28" stroke="#1F2937" strokeWidth="2.5" />
      <path d="M12 25 25 9l15 15-13 13a5 5 0 0 1-7 0l-8-8a3 3 0 0 1 0-4Z" fill="#FFFFFF" stroke="#1F2937" strokeWidth="2.5" />
      <path d="M19 17 33 31" stroke="#60A5FA" strokeWidth="4" />
      <path d="M35 30c4 3 6 6 6 9a5 5 0 0 1-10 0c0-3 2-6 4-9Z" fill="#29B6F6" stroke="#1F2937" strokeWidth="2" />
    </svg>
  );
}

function EraserIcon() {
  return (
    <svg
      aria-hidden
      viewBox="0 0 48 48"
      className="h-10 w-10"
      fill="none"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M18 36 7 25 25 7l16 16-13 13H18Z" fill="#FCA5A5" stroke="#1F2937" strokeWidth="2.5" />
      <path d="M18 36h24" stroke="#1F2937" strokeWidth="2.5" />
      <path d="M17 15 33 31" stroke="#FFFFFF" strokeWidth="4" />
    </svg>
  );
}
