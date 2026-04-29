/**
 * 외곽선 마스크 (설계서 6.2.1)
 *
 * 내부 픽셀 단위 (DPR 곱한 캔버스 width/height)에서 1바이트/픽셀.
 *  0 = 빈 공간 (색칠 가능)
 *  1 = 외곽선 (Flood Fill 경계)
 *
 * 이미지를 임시 캔버스에 그려 ImageData를 가져와서 흑백 판정.
 * - alpha > 128 && luminance < BARRIER_LUMINANCE → 외곽선
 *
 * 도안당 1회만 빌드, IndexedDB pages_cache 에 ArrayBuffer로 저장.
 *
 * v2: AI(Replicate) 변환 도안의 회색조/안티앨리어싱 선까지 잡도록
 *     임계값 80→200으로 올리고 1픽셀 dilation으로 갭 메움.
 */

export interface OutlineMaskInfo {
  bytes: Uint8Array;
  width: number; // 마스크 픽셀 폭 (canvas internal width와 동일)
  height: number;
}

// 마스크 알고리즘이 바뀔 때마다 +1. 캐시 무효화에 사용.
export const MASK_VERSION = 2;

// 이 값보다 어두운 픽셀은 외곽선으로 간주.
// OpenCV(이진화): 선이 luminance 0이라 임계값 어떤 값이든 OK.
// AI(Replicate): 회색조/안티앨리어싱 선이 luminance 100~200 → 200으로 잡아야 갭 X.
const BARRIER_LUMINANCE = 200;

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
  drawImageContained(tctx, image, width, height);
  const data = tctx.getImageData(0, 0, width, height).data;

  const raw = new Uint8Array(width * height);
  for (let i = 0, p = 0; i < data.length; i += 4, p++) {
    const r = data[i];
    const g = data[i + 1];
    const b = data[i + 2];
    const a = data[i + 3];
    const luminance = 0.299 * r + 0.587 * g + 0.114 * b;
    if (a > 128 && luminance < BARRIER_LUMINANCE) {
      raw[p] = 1;
    }
  }

  // 1-pixel dilation: 안티앨리어싱으로 인한 1픽셀 갭을 메워서
  // flood fill이 outline을 통과하지 못하게 함.
  const bytes = dilateMask(raw, width, height);

  return { bytes, width, height };
}

/**
 * 1-pixel 4-방향 dilation. 입력 1바이트/픽셀(0 또는 1).
 * 외곽선 1픽셀을 사방으로 확장해 안티앨리어싱 갭을 닫는다.
 */
function dilateMask(src: Uint8Array, width: number, height: number): Uint8Array {
  const dst = new Uint8Array(src.length);
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const i = y * width + x;
      if (src[i]) {
        dst[i] = 1;
        continue;
      }
      // 상하좌우 중 하나라도 barrier면 이 픽셀도 barrier로 확장
      if (
        (x > 0 && src[i - 1]) ||
        (x < width - 1 && src[i + 1]) ||
        (y > 0 && src[i - width]) ||
        (y < height - 1 && src[i + width])
      ) {
        dst[i] = 1;
      }
    }
  }
  return dst;
}

function drawImageContained(
  ctx: CanvasRenderingContext2D,
  image: HTMLImageElement | HTMLCanvasElement | ImageBitmap,
  width: number,
  height: number,
): void {
  const sourceWidth = 'naturalWidth' in image ? image.naturalWidth : image.width;
  const sourceHeight = 'naturalHeight' in image ? image.naturalHeight : image.height;
  const scale = Math.min(width / sourceWidth, height / sourceHeight);
  const drawWidth = sourceWidth * scale;
  const drawHeight = sourceHeight * scale;
  const x = (width - drawWidth) / 2;
  const y = (height - drawHeight) / 2;
  ctx.drawImage(image, x, y, drawWidth, drawHeight);
}
