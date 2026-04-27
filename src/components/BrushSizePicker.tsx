import clsx from 'clsx';
import { BRUSH_SIZES, type BrushSizeKey } from './brushSizes';

const ORDER: BrushSizeKey[] = ['thin', 'medium', 'thick'];

interface Props {
  value: BrushSizeKey;
  onChange: (key: BrushSizeKey) => void;
  color: string;
}

export function BrushSizePicker({ value, onChange, color }: Props) {
  return (
    <div className="flex items-center gap-2">
      {ORDER.map((k) => {
        const px = BRUSH_SIZES[k];
        const selected = k === value;
        const dotSize = Math.max(8, Math.min(40, px));
        return (
          <button
            key={k}
            type="button"
            aria-label={`붓 굵기 ${k}`}
            aria-pressed={selected}
            onPointerDown={(e) => e.preventDefault()}
            onClick={() => onChange(k)}
            className={clsx(
              'shrink-0 w-touch-lg h-touch-lg rounded-2xl flex items-center justify-center transition',
              selected ? 'bg-white ring-4 ring-app-orange' : 'bg-white/60 ring-2 ring-black/10',
            )}
          >
            <span
              className="rounded-full"
              style={{ width: dotSize, height: dotSize, backgroundColor: color }}
            />
          </button>
        );
      })}
    </div>
  );
}
