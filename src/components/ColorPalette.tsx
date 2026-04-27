import clsx from 'clsx';
import { PAINT_COLORS, type PaintColor } from './paintColors';

interface Props {
  value: string; // hex
  onChange: (color: PaintColor) => void;
}

export function ColorPalette({ value, onChange }: Props) {
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
    </div>
  );
}
