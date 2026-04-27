import { HistoryStack } from './HistoryStack';

/**
 * 캔버스 그리기 엔진 (설계서 6.1)
 *
 * 책임:
 *  - 두 레이어 관리 (paint A / outline B)
 *  - DPR 보정 setup
 *  - stroke 그리기 (quadraticCurveTo 부드러운 곡선)
 *  - 지우개 (destination-out 합성)
 *  - 도안 외곽선 로드 → Canvas B
 *  - Undo/Redo (HistoryStack)
 *
 * V2 범위:
 *  - 단일 pointer (multi-touch / palm rejection은 V3)
 *  - Flood Fill 미구현 (V3)
 */

export type Tool = 'brush' | 'eraser';

export interface CanvasEngineConfig {
  paintCanvas: HTMLCanvasElement;
  outlineCanvas: HTMLCanvasElement;
  cssWidth: number;
  cssHeight: number;
}

export interface EngineState {
  canUndo: boolean;
  canRedo: boolean;
  isDirty: boolean; // 한 번이라도 그렸나
}

export class CanvasEngine {
  private paintCtx: CanvasRenderingContext2D;
  private outlineCtx: CanvasRenderingContext2D;
  readonly width: number;
  readonly height: number;

  private tool: Tool = 'brush';
  private color = '#E53935';
  private brushSize = 16;

  private isStroking = false;
  private lastX = 0;
  private lastY = 0;

  private history = new HistoryStack();
  private dirty = false;

  private listeners = new Set<(s: EngineState) => void>();

  constructor(config: CanvasEngineConfig) {
    this.width = config.cssWidth;
    this.height = config.cssHeight;
    this.paintCtx = setupCanvas(config.paintCanvas, config.cssWidth, config.cssHeight);
    this.outlineCtx = setupCanvas(config.outlineCanvas, config.cssWidth, config.cssHeight);

    // 부드러운 곡선의 기본값
    this.paintCtx.lineCap = 'round';
    this.paintCtx.lineJoin = 'round';

    // 빈 캔버스를 history에 push — undo로 빈 상태 복귀 가능하게
    this.history.push(this.snapshotPaint());
  }

  // ---------- 설정 ----------
  setTool(tool: Tool): void {
    this.tool = tool;
  }

  setColor(hex: string): void {
    this.color = hex;
  }

  setBrushSize(px: number): void {
    this.brushSize = px;
  }

  // ---------- 외곽선 ----------
  drawOutline(image: HTMLImageElement | HTMLCanvasElement | ImageBitmap): void {
    this.outlineCtx.clearRect(0, 0, this.width, this.height);
    this.outlineCtx.drawImage(image, 0, 0, this.width, this.height);
  }

  clearOutline(): void {
    this.outlineCtx.clearRect(0, 0, this.width, this.height);
  }

  // ---------- 그리기 ----------
  /**
   * @param point 캔버스 CSS 좌표
   */
  strokeStart(point: { x: number; y: number }): void {
    this.isStroking = true;
    this.lastX = point.x;
    this.lastY = point.y;

    const ctx = this.paintCtx;
    ctx.lineWidth = this.brushSize;
    if (this.tool === 'eraser') {
      ctx.globalCompositeOperation = 'destination-out';
      ctx.strokeStyle = '#000';
    } else {
      ctx.globalCompositeOperation = 'source-over';
      ctx.strokeStyle = this.color;
    }

    // 단일 점 탭도 보이도록 dot 찍기
    ctx.beginPath();
    ctx.arc(point.x, point.y, this.brushSize / 2, 0, Math.PI * 2);
    ctx.fillStyle = this.tool === 'eraser' ? '#000' : this.color;
    ctx.fill();
  }

  strokeMove(point: { x: number; y: number }): void {
    if (!this.isStroking) return;
    const ctx = this.paintCtx;

    const midX = (this.lastX + point.x) / 2;
    const midY = (this.lastY + point.y) / 2;

    ctx.beginPath();
    ctx.moveTo(this.lastX, this.lastY);
    ctx.quadraticCurveTo(this.lastX, this.lastY, midX, midY);
    ctx.stroke();

    this.lastX = point.x;
    this.lastY = point.y;
  }

  strokeEnd(): void {
    if (!this.isStroking) return;
    this.isStroking = false;

    // 합성 모드 원복
    this.paintCtx.globalCompositeOperation = 'source-over';

    this.dirty = true;
    this.history.push(this.snapshotPaint());
    this.notify();
  }

  strokeCancel(): void {
    if (!this.isStroking) return;
    this.isStroking = false;
    this.paintCtx.globalCompositeOperation = 'source-over';
    // 진행 중이던 stroke 결과를 직전 history 상태로 되돌림
    const prev = this.history.current();
    if (prev) this.paintCtx.putImageData(prev, 0, 0);
  }

  // ---------- Undo / Redo ----------
  undo(): boolean {
    const data = this.history.undo();
    if (!data) return false;
    this.paintCtx.putImageData(data, 0, 0);
    this.notify();
    return true;
  }

  redo(): boolean {
    const data = this.history.redo();
    if (!data) return false;
    this.paintCtx.putImageData(data, 0, 0);
    this.notify();
    return true;
  }

  // ---------- 추출 ----------
  /**
   * 색칠 + 외곽선을 합쳐 PNG Blob으로 반환.
   * 흰 배경 → 색칠 → 외곽선 순서로 합성.
   */
  async exportComposite(): Promise<Blob> {
    const tmp = document.createElement('canvas');
    tmp.width = this.paintCtx.canvas.width;
    tmp.height = this.paintCtx.canvas.height;
    const tctx = tmp.getContext('2d');
    if (!tctx) throw new Error('2D context unavailable');

    tctx.fillStyle = '#ffffff';
    tctx.fillRect(0, 0, tmp.width, tmp.height);
    tctx.drawImage(this.paintCtx.canvas, 0, 0);
    tctx.drawImage(this.outlineCtx.canvas, 0, 0);

    return new Promise<Blob>((resolve, reject) => {
      tmp.toBlob((blob) => {
        if (blob) resolve(blob);
        else reject(new Error('toBlob 실패'));
      }, 'image/png');
    });
  }

  // ---------- 상태 관찰 ----------
  getState(): EngineState {
    return { canUndo: this.history.canUndo, canRedo: this.history.canRedo, isDirty: this.dirty };
  }

  subscribe(listener: (s: EngineState) => void): () => void {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }

  // ---------- 내부 ----------
  private snapshotPaint(): ImageData {
    const c = this.paintCtx.canvas;
    return this.paintCtx.getImageData(0, 0, c.width, c.height);
  }

  private notify(): void {
    const s = this.getState();
    for (const l of this.listeners) l(s);
  }
}

export function setupCanvas(
  canvas: HTMLCanvasElement,
  cssWidth: number,
  cssHeight: number,
): CanvasRenderingContext2D {
  const dpr = window.devicePixelRatio || 1;
  canvas.width = cssWidth * dpr;
  canvas.height = cssHeight * dpr;
  canvas.style.width = `${cssWidth}px`;
  canvas.style.height = `${cssHeight}px`;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('2D context unavailable');
  ctx.scale(dpr, dpr);
  return ctx;
}
