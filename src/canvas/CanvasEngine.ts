/**
 * 캔버스 그리기 엔진 (설계서 6.1)
 *
 * - 두 레이어 구조: 색칠 레이어(A) + 외곽선 레이어(B, pointer-events:none)
 * - DPR 보정 setupCanvas
 * - stroke quadraticCurveTo
 *
 * TODO: 다음 마일스톤(2주차)에서 구현.
 */

export interface CanvasEngineConfig {
  paintCanvas: HTMLCanvasElement; // Canvas A (색칠)
  outlineCanvas: HTMLCanvasElement; // Canvas B (도안)
  width: number;
  height: number;
}

export class CanvasEngine {
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  constructor(_config: CanvasEngineConfig) {
    // TODO
  }
}

export function setupCanvas(canvas: HTMLCanvasElement, w: number, h: number): CanvasRenderingContext2D {
  const dpr = window.devicePixelRatio || 1;
  canvas.width = w * dpr;
  canvas.height = h * dpr;
  canvas.style.width = `${w}px`;
  canvas.style.height = `${h}px`;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('2D context unavailable');
  ctx.scale(dpr, dpr);
  return ctx;
}
