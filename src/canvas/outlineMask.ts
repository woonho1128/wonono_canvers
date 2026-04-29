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
// v4: trim 알고리즘을 density 기반(노이즈 robust)으로 변경.
export const MASK_VERSION = 4;

// trim 시 "콘텐츠 픽셀" 판정: R/G/B 어느 하나라도 이 값 미만이면 콘텐츠로 간주.
// AI 출력의 압축 노이즈/회색조 라인까지 잡되 흰 배경(보통 R/G/B≥250)은 제외.
const TRIM_CONTENT_DARKNESS = 235;
// trim 후 콘텐츠 주변 padding (라인 가장자리 안티앨리어싱 보존용).
const TRIM_PADDING_PX = 2;
// 행/열을 "콘텐츠 행/열"로 간주하는 최소 콘텐츠 픽셀 비율(전체 너비/높이의 %).
// 0.5% 미만의 콘텐츠는 노이즈로 보고 trim 대상에 포함.
const TRIM_ROW_DENSITY_THRESHOLD = 0.005;

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

/**
 * 도안 이미지에서 흰 패딩(알파 0 또는 거의 흰색)을 잘라낸 결과를 새 canvas로 반환.
 *
 * AI(Replicate) 변환 도안은 입력 사진과 같은 비율로 출력되지만, 모델이 정사각형
 * 캔버스에 그림을 채워넣기 위해 위/아래 또는 좌/우에 흰 padding을 넣는 경우가 있다.
 * 이 padding이 그대로 mask에 들어가면 flood fill이 padding 영역에서 멈추지 않고
 * 모든 가장자리를 따라 퍼져 "위아래만 칠해지는" 현상이 발생.
 *
 * 해결: 외곽선이 있는 영역(bbox)만 잘라내 새 canvas로 만들어 그리기/마스크에 사용.
 * OpenCV 출력(투명 배경)은 alpha=0이 모두 trim되므로 자연스럽게 작동.
 */
export function trimImageWhitespace(
  image: HTMLImageElement | HTMLCanvasElement | ImageBitmap,
): HTMLCanvasElement {
  const w = 'naturalWidth' in image ? image.naturalWidth : image.width;
  const h = 'naturalHeight' in image ? image.naturalHeight : image.height;

  const tmp = document.createElement('canvas');
  tmp.width = w;
  tmp.height = h;
  const tctx = tmp.getContext('2d', { willReadFrequently: true });
  if (!tctx) throw new Error('2D context unavailable');
  tctx.drawImage(image, 0, 0);
  const data = tctx.getImageData(0, 0, w, h).data;

  // 행/열별로 "콘텐츠 픽셀(어두운 라인 픽셀)" 개수 누적.
  // 단일 노이즈 픽셀에 영향받지 않게 밀도 기반으로 trim.
  const rowCount = new Int32Array(h);
  const colCount = new Int32Array(w);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const i = (y * w + x) * 4;
      const r = data[i];
      const g = data[i + 1];
      const b = data[i + 2];
      const a = data[i + 3];
      const isContent =
        a > 64 &&
        (r < TRIM_CONTENT_DARKNESS ||
          g < TRIM_CONTENT_DARKNESS ||
          b < TRIM_CONTENT_DARKNESS);
      if (isContent) {
        rowCount[y]++;
        colCount[x]++;
      }
    }
  }

  // 콘텐츠 행/열로 인정되려면 전체 너비/높이의 일정 비율 이상의 콘텐츠 픽셀이 있어야 함.
  const rowMin = Math.max(2, Math.floor(w * TRIM_ROW_DENSITY_THRESHOLD));
  const colMin = Math.max(2, Math.floor(h * TRIM_ROW_DENSITY_THRESHOLD));

  let minY = -1;
  let maxY = -1;
  for (let y = 0; y < h; y++) {
    if (rowCount[y] >= rowMin) {
      if (minY < 0) minY = y;
      maxY = y;
    }
  }
  let minX = -1;
  let maxX = -1;
  for (let x = 0; x < w; x++) {
    if (colCount[x] >= colMin) {
      if (minX < 0) minX = x;
      maxX = x;
    }
  }

  // 콘텐츠가 전혀 없거나 이미 거의 가득 차있으면 원본 그대로 반환
  if (maxX < 0 || maxY < 0) return tmp;
  const sx = Math.max(0, minX - TRIM_PADDING_PX);
  const sy = Math.max(0, minY - TRIM_PADDING_PX);
  const sw = Math.min(w, maxX + TRIM_PADDING_PX + 1) - sx;
  const sh = Math.min(h, maxY + TRIM_PADDING_PX + 1) - sy;
  if (sw >= w - TRIM_PADDING_PX * 2 && sh >= h - TRIM_PADDING_PX * 2) return tmp;

  const out = document.createElement('canvas');
  out.width = sw;
  out.height = sh;
  const octx = out.getContext('2d');
  if (!octx) throw new Error('2D context unavailable');
  octx.drawImage(tmp, -sx, -sy);
  return out;
}

/**
 * Canvas → PNG Blob 헬퍼.
 */
export function canvasToPngBlob(canvas: HTMLCanvasElement): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob((b) => (b ? resolve(b) : reject(new Error('toBlob 실패'))), 'image/png');
  });
}
