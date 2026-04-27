import { useCallback, useRef, useState, type ReactNode } from 'react';
import clsx from 'clsx';

interface Props {
  /** hold 완료 시 호출 */
  onConfirm: () => void;
  /** ms — 기본 1000 */
  holdMs?: number;
  /** disabled 상태 */
  disabled?: boolean;
  /** aria-label */
  label: string;
  /** 버튼 콘텐츠 (이모지/텍스트) */
  children: ReactNode;
  /** 커스텀 스타일 (기본은 투명한 white) */
  className?: string;
}

/**
 * 길게 눌러 확정 (설계서 5.3.4 — "처음부터 다시" 1초 hold).
 *
 * - pointerdown 시작 → 시각적 ring 채워짐
 * - holdMs 동안 떼지 않으면 onConfirm
 * - 도중에 떼거나 leave/cancel 시 ring 0%로 reset
 * - 5세 오작동 방지가 핵심
 */
export function HoldToConfirm({
  onConfirm,
  holdMs = 1000,
  disabled = false,
  label,
  children,
  className,
}: Props) {
  const [progress, setProgress] = useState(0); // 0..1
  const rafRef = useRef<number | null>(null);
  const startedAtRef = useRef<number | null>(null);
  const confirmedRef = useRef(false);

  const stop = useCallback(() => {
    if (rafRef.current !== null) {
      cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
    }
    startedAtRef.current = null;
    setProgress(0);
  }, []);

  const start = useCallback(() => {
    if (disabled) return;
    if (startedAtRef.current !== null) return;
    startedAtRef.current = performance.now();

    const tick = () => {
      const startedAt = startedAtRef.current;
      if (startedAt === null) return;
      const elapsed = performance.now() - startedAt;
      const p = Math.min(1, elapsed / holdMs);
      setProgress(p);
      if (p >= 1) {
        startedAtRef.current = null;
        rafRef.current = null;
        setProgress(0);
        confirmedRef.current = true;
        onConfirm();
        return;
      }
      rafRef.current = requestAnimationFrame(tick);
    };
    rafRef.current = requestAnimationFrame(tick);
  }, [disabled, holdMs, onConfirm]);

  return (
    <button
      type="button"
      aria-label={label}
      disabled={disabled}
      onPointerDown={(e) => {
        try {
          e.currentTarget.setPointerCapture(e.pointerId);
        } catch {
          // 일부 브라우저/dispatched events는 throw — 무시
        }
        start();
      }}
      onPointerUp={stop}
      onPointerCancel={stop}
      onPointerLeave={stop}
      onClick={() => {
        if (disabled) return;
        if (confirmedRef.current) {
          confirmedRef.current = false;
          return;
        }
        onConfirm();
      }}
      className={clsx(
        'relative shrink-0 w-touch-lg h-touch-lg rounded-2xl overflow-hidden',
        'flex items-center justify-center text-3xl select-none',
        'disabled:opacity-30',
        className ?? 'bg-white ring-2 ring-app-danger/40',
      )}
    >
      {/* 진행 ring — 아래쪽부터 채워짐 */}
      <span
        aria-hidden
        className="absolute inset-0 bg-app-danger/30 origin-bottom transition-none pointer-events-none"
        style={{ transform: `scaleY(${progress})` }}
      />
      <span className="relative z-10">{children}</span>
    </button>
  );
}
