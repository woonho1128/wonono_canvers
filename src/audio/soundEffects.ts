/**
 * 효과음 엔진 (설계서 6.6)
 *
 * Web Audio API로 절차적으로 톤을 생성 — mp3 파일 의존성 없음.
 * 짧고 가벼운 캐릭터 사운드 위주 (5세에 즉각적 피드백).
 *
 * iOS autoplay 정책: AudioContext는 첫 user gesture 안에서 생성/resume 되어야
 * 동작. 첫 호출이 user gesture 바깥(예: stroke 자동저장 후)이면 noop.
 */

export type SoundId =
  | 'pickColor' // 색 선택 — 짧은 클릭
  | 'fill' // 물통 — 빠른 sweep
  | 'save' // 저장 완료 — 상승 fanfare
  | 'undo' // 되돌리기 — 역방향 swoosh
  | 'reset' // 처음부터 — 부드러운 wobble
  | 'home'; // 홈 진입 — 짧은 인트로

let audioCtx: AudioContext | null = null;
let enabled = true;
let primed = false;

export function setSoundEnabled(v: boolean): void {
  enabled = v;
}

export function isSoundEnabled(): boolean {
  return enabled;
}

/**
 * 첫 user gesture 안에서 호출 — iOS unlock.
 * pointerdown 핸들러나 click에서 한 번만 호출하면 그 후 자동 동작.
 */
export function primeAudio(): void {
  if (primed) return;
  ensureCtx();
  primed = true;
}

function ensureCtx(): AudioContext | null {
  if (!enabled) return null;
  if (typeof window === 'undefined') return null;
  if (audioCtx) {
    // suspended 상태 복귀 시도
    if (audioCtx.state === 'suspended') void audioCtx.resume();
    return audioCtx;
  }
  const Ctx =
    window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  if (!Ctx) return null;
  try {
    audioCtx = new Ctx();
    return audioCtx;
  } catch {
    return null;
  }
}

export function play(id: SoundId): void {
  const ctx = ensureCtx();
  if (!ctx) return;
  switch (id) {
    case 'pickColor':
      tone(ctx, 740, 0.05, 'sine', 0.12);
      break;
    case 'fill':
      sweep(ctx, 220, 880, 0.18, 'square', 0.08);
      break;
    case 'save':
      sequence(ctx, [523, 659, 784], 0.12, 'sine', 0.14);
      break;
    case 'undo':
      sweep(ctx, 660, 330, 0.1, 'triangle', 0.1);
      break;
    case 'reset':
      sweep(ctx, 440, 180, 0.25, 'sawtooth', 0.07);
      break;
    case 'home':
      sequence(ctx, [659, 880], 0.12, 'sine', 0.1);
      break;
  }
}

function tone(
  ctx: AudioContext,
  freq: number,
  durSec: number,
  type: 'sine' | 'square' | 'triangle' | 'sawtooth',
  gainPeak: number,
  startOffset = 0,
): void {
  const t0 = ctx.currentTime + startOffset;
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  osc.type = type;
  osc.frequency.setValueAtTime(freq, t0);
  gain.gain.setValueAtTime(0, t0);
  gain.gain.linearRampToValueAtTime(gainPeak, t0 + 0.005);
  gain.gain.exponentialRampToValueAtTime(0.0001, t0 + durSec);
  osc.connect(gain).connect(ctx.destination);
  osc.start(t0);
  osc.stop(t0 + durSec + 0.02);
}

function sweep(
  ctx: AudioContext,
  fromHz: number,
  toHz: number,
  durSec: number,
  type: 'sine' | 'square' | 'triangle' | 'sawtooth',
  gainPeak: number,
): void {
  const t0 = ctx.currentTime;
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  osc.type = type;
  osc.frequency.setValueAtTime(fromHz, t0);
  osc.frequency.exponentialRampToValueAtTime(Math.max(1, toHz), t0 + durSec);
  gain.gain.setValueAtTime(0, t0);
  gain.gain.linearRampToValueAtTime(gainPeak, t0 + 0.01);
  gain.gain.exponentialRampToValueAtTime(0.0001, t0 + durSec);
  osc.connect(gain).connect(ctx.destination);
  osc.start(t0);
  osc.stop(t0 + durSec + 0.02);
}

function sequence(
  ctx: AudioContext,
  freqs: number[],
  perNote: number,
  type: 'sine' | 'square' | 'triangle' | 'sawtooth',
  gainPeak: number,
): void {
  freqs.forEach((f, i) => tone(ctx, f, perNote, type, gainPeak, i * perNote * 0.85));
}
