/**
 * React PointerEvent에서 캔버스 CSS 좌표 추출.
 * CanvasEngine은 CSS 픽셀 단위로 동작 (DPR은 ctx.scale로 흡수).
 */
export function getCanvasPoint(e: { clientX: number; clientY: number; currentTarget: HTMLCanvasElement }): {
  x: number;
  y: number;
} {
  const rect = e.currentTarget.getBoundingClientRect();
  return {
    x: e.clientX - rect.left,
    y: e.clientY - rect.top,
  };
}
