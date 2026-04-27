/**
 * 마스크 기반 Flood Fill (설계서 6.2)
 *
 * - 픽셀 색 비교 X, 외곽선 마스크(Uint8Array)를 절대 기준으로 사용
 * - 스택 기반 DFS, ImageData 한 번 가져와 일괄 처리
 *
 * TODO: 2주차 구현.
 */

export interface FloodFillParams {
  ctx: CanvasRenderingContext2D;
  mask: Uint8Array; // 0=빈공간, 1=외곽선
  width: number;
  height: number;
  startX: number;
  startY: number;
  fillColor: [number, number, number, number]; // RGBA
}

export function floodFillWithMask(_params: FloodFillParams): void {
  // TODO
  throw new Error('not implemented');
}
