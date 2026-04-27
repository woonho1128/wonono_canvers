/**
 * 외곽선 마스크 (설계서 6.2.1)
 *
 * 내부 픽셀 단위 (DPR 곱한 캔버스 width/height)에서 1바이트/픽셀.
 *  0 = 빈 공간 (색칠 가능)
 *  1 = 외곽선 (Flood Fill 경계)
 *
 * 이미지를 임시 캔버스에 그려 ImageData를 가져와서 흑백 판정.
 * - alpha > 128 && luminance < 80 → 외곽선
 *
 * 도안당 1회만 빌드, IndexedDB pages_cache 에 ArrayBuffer로 저장.
 */

export interface OutlineMaskInfo {
  bytes: Uint8Array;
  width: number; // 마스크 픽셀 폭 (canvas internal width와 동일)
  height: number;
}

export function buildOutlineMask(
  image: HTMLImageElement | HTMLCanvasElement | ImageBitmap,
  width: number,
  height: number,
): OutlineMaskInfo {
  const tmp = document.createElement('canvas');
  tmp.width = width;
  tmp.height = height;
  const tctx = tmp.getContext('2d', { willReadFrequently: true });
  if (!tctx) throw new Error('2D context unavailable');
  tctx.drawImage(image, 0, 0, width, height);
  const data = tctx.getImageData(0, 0, width, height).data;

  const bytes = new Uint8Array(width * height);
  for (let i = 0, p = 0; i < data.length; i += 4, p++) {
    const r = data[i];
    const g = data[i + 1];
    const b = data[i + 2];
    const a = data[i + 3];
    const luminance = 0.299 * r + 0.587 * g + 0.114 * b;
    if (a > 128 && luminance < 80) {
      bytes[p] = 1;
    }
  }
  return { bytes, width, height };
}
