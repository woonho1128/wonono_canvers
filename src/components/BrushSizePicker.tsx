import { BRUSH_STEP, MAX_BRUSH, MIN_BRUSH } from './brushSizes';

interface Props {
  value: number; // px
  onChange: (px: number) => void;
  color: string;
}

/**
 * 굵기 슬라이더. 좌측에 현재 굵기 미리보기 점 + 우측 range input.
 * 5세도 손가락으로 끌 수 있도록 트랙/썸 모두 충분히 큼.
 */
export function BrushSizePicker({ value, onChange, color }: Props) {
  const previewSize = Math.max(8, Math.min(40, value));

  return (
    <div className="flex items-center gap-3 px-2">
      {/* 미리보기 점 */}
      <div
        className="shrink-0 w-touch-lg h-touch-lg rounded-2xl bg-white ring-2 ring-black/10 flex items-center justify-center"
        aria-hidden
      >
        <span
          className="rounded-full transition-all"
          style={{ width: previewSize, height: previewSize, backgroundColor: color }}
        />
      </div>

      {/* 슬라이더 */}
      <input
        type="range"
        min={MIN_BRUSH}
        max={MAX_BRUSH}
        step={BRUSH_STEP}
        value={value}
        onChange={(e) => onChange(parseInt(e.target.value, 10))}
        aria-label="붓 굵기"
        className="kid-brush-slider w-44 sm:w-56 lg:w-64 h-touch-lg"
        style={{ accentColor: color }}
      />
    </div>
  );
}
