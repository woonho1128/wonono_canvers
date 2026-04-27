import clsx from 'clsx';
import type { Tool } from '@/canvas/CanvasEngine';

interface Props {
  value: Tool;
  onChange: (tool: Tool) => void;
}

const TOOLS: { id: Tool; label: string; emoji: string }[] = [
  { id: 'brush', label: '붓', emoji: '🖌️' },
  { id: 'fill', label: '물통', emoji: '💧' },
  { id: 'eraser', label: '지우개', emoji: '🧹' },
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
              'shrink-0 w-touch-lg h-touch-lg rounded-2xl text-3xl flex items-center justify-center transition',
              selected ? 'bg-white ring-4 ring-app-orange' : 'bg-white/60 ring-2 ring-black/10',
            )}
          >
            {t.emoji}
          </button>
        );
      })}
    </div>
  );
}
