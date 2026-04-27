import { HistoryStack } from './HistoryStack';
import { floodFillWithMask } from './floodFill';
import { buildOutlineMask, type OutlineMaskInfo } from './outlineMask';

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

export type Tool = 'brush' | 'eraser' | 'fill';

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
  readonly width: number; // CSS pixels
  readonly height: number;
  readonly internalWidth: number; // canvas.width (DPR 곱한)
  readonly internalHeight: number;
  readonly dpr: number;

  private tool: Tool = 'brush';
  private color = '#E53935';
  private brushSize = 16;

  private isStroking = false;
  private lastX = 0;
  private lastY = 0;

  private history = new HistoryStack();
  private dirty = false;

  private outlineMask: OutlineMaskInfo | null = null;

  private listeners = new Set<(s: EngineState) => void>();

  constructor(config: CanvasEngineConfig) {
    this.width = config.cssWidth;
    this.height = config.cssHeight;
    this.dpr = window.devicePixelRatio || 1;
    this.internalWidth = config.cssWidth * this.dpr;
    this.internalHeight = config.cssHeight * this.dpr;
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

  /**
   * 외곽선 마스크 빌드 또는 외부에서 받은 마스크 주입.
   * 마스크는 내부 픽셀(canvas.width) 단위.
   */
  setOutlineMask(mask: OutlineMaskInfo): void {
    this.outlineMask = mask;
  }

  buildAndSetMask(image: HTMLImageElement | HTMLCanvasElement | ImageBitmap): OutlineMaskInfo {
    const mask = buildOutlineMask(image, this.internalWidth, this.internalHeight);
    this.outlineMask = mask;
    return mask;
  }

  hasMask(): boolean {
    return this.outlineMask !== null;
  }

  // ---------- 그리기 ----------
  /**
   * @param point 캔버스 CSS 좌표
   */
  strokeStart(point: { x: number; y: number }): void {
    if (this.tool === 'fill') {
      // 단발성 — stroke 시작이 곧 끝. isStroking 미설정.
      this.applyFloodFill(point);
      return;
    }

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

  private applyFloodFill(point: { x: number; y: number }): void {
    if (!this.outlineMask) return;
    // CSS → 내부 픽셀 좌표
    const ix = Math.floor(point.x * this.dpr);
    const iy = Math.floor(point.y * this.dpr);

    // Flood Fill은 내부 픽셀 단위 ImageData에서 작동.
    // ctx.scale(dpr, dpr) 상태에서 putImageData는 변환 무시하고 내부 좌표에 그대로 들어감.
    const ok = floodFillWithMask({
      ctx: this.paintCtx,
      mask: this.outlineMask.bytes,
      width: this.outlineMask.width,
      height: this.outlineMask.height,
      startX: ix,
      startY: iy,
      fillColor: hexToRgba(this.color),
    });
    if (!ok) return;

    this.dirty = true;
    this.history.push(this.snapshotPaint());
    this.notify();
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

  // ---------- 캔버스 조작 ----------
  /**
   * 색칠 레이어 전체 초기화 + history reset.
   * "처음부터 다시" 동작. 외곽선은 유지.
   */
  resetPaint(): void {
    const c = this.paintCtx.canvas;
    this.paintCtx.save();
    this.paintCtx.setTransform(1, 0, 0, 1, 0, 0);
    this.paintCtx.clearRect(0, 0, c.width, c.height);
    this.paintCtx.restore();
    this.history.clear();
    this.history.push(this.snapshotPaint());
    this.dirty = false;
    this.notify();
  }

  /**
   * 외부에서 받은 Blob(미완성 작품)을 색칠 레이어에 복원.
   * 자동저장 draft 이어 그리기에 사용.
   */
  async loadPaintBlob(blob: Blob): Promise<void> {
    const url = URL.createObjectURL(blob);
    try {
      const img = await new Promise<HTMLImageElement>((res, rej) => {
        const i = new Image();
        i.onload = () => res(i);
        i.onerror = () => rej(new Error('image load failed'));
        i.src = url;
      });
      const c = this.paintCtx.canvas;
      this.paintCtx.save();
      this.paintCtx.setTransform(1, 0, 0, 1, 0, 0);
      this.paintCtx.clearRect(0, 0, c.width, c.height);
      this.paintCtx.drawImage(img, 0, 0, c.width, c.height);
      this.paintCtx.restore();
      this.history.clear();
      this.history.push(this.snapshotPaint());
      this.dirty = true;
      this.notify();
    } finally {
      URL.revokeObjectURL(url);
    }
  }

  // ---------- 추출 ----------
  /**
   * 색칠 레이어만 PNG Blob으로 반환 (자동저장 draft용).
   */
  async exportPaintBlob(): Promise<Blob> {
    return new Promise<Blob>((resolve, reject) => {
      this.paintCtx.canvas.toBlob((blob) => {
        if (blob) resolve(blob);
        else reject(new Error('toBlob 실패'));
      }, 'image/png');
    });
  }

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
  /**
   * 내부 픽셀 단위 스냅샷 (canvas.width × canvas.height).
   * ctx.scale(dpr, dpr) 상태와 무관하게 putImageData는 내부 좌표 단위로 동작.
   */
  private snapshotPaint(): ImageData {
    const c = this.paintCtx.canvas;
    return this.paintCtx.getImageData(0, 0, c.width, c.height);
  }

  private notify(): void {
    const s = this.getState();
    for (const l of this.listeners) l(s);
  }
}

function hexToRgba(hex: string): [number, number, number, number] {
  const m = hex.match(/^#?([0-9a-f]{6})$/i);
  if (!m) return [0, 0, 0, 255];
  const n = parseInt(m[1], 16);
  return [(n >> 16) & 0xff, (n >> 8) & 0xff, n & 0xff, 255];
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
