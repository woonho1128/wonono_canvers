/**
 * 마스크 기반 Flood Fill (설계서 6.2)
 *
 * - 외곽선 마스크(Uint8Array)를 절대 기준으로 사용 → 사용자 색과 무관
 * - Stack 기반 DFS (BFS의 shift보다 빠름)
 * - ImageData 한 번 가져와 일괄 처리
 * - 시작점이 외곽선이면 noop (실수 방지)
 *
 * 좌표계: 모두 내부 픽셀(canvas.width 단위). 호출자가 DPR 변환을 책임진다.
 */

export interface FloodFillParams {
  ctx: CanvasRenderingContext2D;
  mask: Uint8Array; // 0 빈공간, 1 외곽선
  width: number;
  height: number;
  startX: number; // 정수, 내부 픽셀
  startY: number;
  fillColor: [number, number, number, number]; // RGBA 0-255
}

export function floodFillWithMask(params: FloodFillParams): boolean {
  const { ctx, mask, width, height, startX, startY, fillColor } = params;

  if (startX < 0 || startX >= width || startY < 0 || startY >= height) return false;
  if (mask[startY * width + startX] === 1) return false;

  const img = ctx.getImageData(0, 0, width, height);
  const data = img.data;
  const visited = new Uint8Array(width * height);

  const stack: number[] = [startX, startY];
  let painted = 0;

  while (stack.length) {
    const y = stack.pop() as number;
    const x = stack.pop() as number;
    if (x < 0 || x >= width || y < 0 || y >= height) continue;

    const pos = y * width + x;
    if (visited[pos]) continue;
    if (mask[pos] === 1) continue;
    visited[pos] = 1;

    const idx = pos * 4;
    data[idx] = fillColor[0];
    data[idx + 1] = fillColor[1];
    data[idx + 2] = fillColor[2];
    data[idx + 3] = fillColor[3];
    painted++;

    stack.push(x + 1, y);
    stack.push(x - 1, y);
    stack.push(x, y + 1);
    stack.push(x, y - 1);
  }

  if (painted > 0) {
    ctx.putImageData(img, 0, 0);
    return true;
  }
  return false;
}
