/// <reference lib="webworker" />
/* eslint-disable @typescript-eslint/no-explicit-any */
/**
 * 외곽선 변환 Web Worker (설계서 6.4.4)
 *
 * 메인 스레드 블록 방지:
 *  - OpenCV.js wasm 초기화가 무거움 (5-15초)
 *  - bilateral / Canny 처리도 1-3초
 *  - 모두 worker에서 실행 → 메인 스레드 응답성 유지
 *
 * 메시지 프로토콜:
 *  in:  { type: 'convert', id, bitmap: ImageBitmap, detail: number }
 *  out: { type: 'result', id, blob: Blob } | { type: 'error', id, message: string }
 *       { type: 'ready' } — 한 번만 보냄, opencv 준비됨 알림
 */

declare const importScripts: (...urls: string[]) => void;
declare const cv: any;

let cvReadyPromise: Promise<void> | null = null;

const OPENCV_SCRIPT_URLS = ['/cv/opencv.js', 'https://docs.opencv.org/4.10.0/opencv.js'];

function loadCV(): Promise<void> {
  if (cvReadyPromise) return cvReadyPromise;
  cvReadyPromise = new Promise<void>((resolve, reject) => {
    let lastError: unknown = null;
    for (const url of OPENCV_SCRIPT_URLS) {
      try {
        importScripts(url);
        lastError = null;
        break;
      } catch (err) {
        lastError = err;
      }
    }

    if (lastError) {
      reject(lastError);
      return;
    }

    const g = self as unknown as { cv?: { Mat?: unknown; onRuntimeInitialized?: () => void } };
    if (g.cv?.Mat) {
      resolve();
    } else if (g.cv) {
      g.cv.onRuntimeInitialized = () => resolve();
    } else {
      reject(new Error('opencv.js loaded but global cv missing'));
    }
  });

  void cvReadyPromise.then(() => {
    (self as unknown as Worker).postMessage({ type: 'ready' });
  });
  return cvReadyPromise;
}

interface ConvertMessage {
  type: 'convert';
  id: string;
  bitmap: ImageBitmap;
  detail: number;
}

self.addEventListener('message', async (e: MessageEvent<ConvertMessage>) => {
  if (e.data.type !== 'convert') return;
  const { id, bitmap, detail } = e.data;
  try {
    await loadCV();
    const blob = await convert(bitmap, detail);
    bitmap.close();
    (self as unknown as Worker).postMessage({ type: 'result', id, blob });
  } catch (err) {
    (self as unknown as Worker).postMessage({
      type: 'error',
      id,
      message: err instanceof Error ? err.message : String(err),
    });
  }
});

const MAX_DIM = 1024;

async function convert(bitmap: ImageBitmap, detail: number): Promise<Blob> {
  const scale = Math.min(1, MAX_DIM / Math.max(bitmap.width, bitmap.height));
  const w = Math.round(bitmap.width * scale);
  const h = Math.round(bitmap.height * scale);

  const inputCanvas = new OffscreenCanvas(w, h);
  const inCtx = inputCanvas.getContext('2d');
  if (!inCtx) throw new Error('OffscreenCanvas 2D context unavailable');
  inCtx.drawImage(bitmap, 0, 0, w, h);
  const imageData = inCtx.getImageData(0, 0, w, h);

  const src = cv.matFromImageData(imageData);
  const gray = new cv.Mat();
  const filtered = new cv.Mat();
  const edges = new cv.Mat();
  const closed = new cv.Mat();
  const inverted = new cv.Mat();
  let kernel: any = null;

  try {
    cv.cvtColor(src, gray, cv.COLOR_RGBA2GRAY);
    cv.bilateralFilter(gray, filtered, 9, 75, 75);

    const t1 = Math.max(20, 100 - detail / 2);
    const t2 = Math.max(50, 200 - detail);
    cv.Canny(filtered, edges, t1, t2);

    kernel = cv.getStructuringElement(cv.MORPH_RECT, new cv.Size(2, 2));
    cv.morphologyEx(edges, closed, cv.MORPH_CLOSE, kernel);

    cv.bitwise_not(closed, inverted);

    // OffscreenCanvas로 출력 — cv.imshow가 OffscreenCanvas 호환되지 않을 수 있어
    // 직접 ImageData로 추출해 OffscreenCanvas에 putImageData
    const out = new OffscreenCanvas(w, h);
    const outCtx = out.getContext('2d');
    if (!outCtx) throw new Error('OffscreenCanvas 2D context unavailable');

    // inverted Mat → RGBA → putImageData
    const outRgba = new cv.Mat();
    cv.cvtColor(inverted, outRgba, cv.COLOR_GRAY2RGBA);
    const outImageData = new ImageData(
      new Uint8ClampedArray(outRgba.data),
      outRgba.cols,
      outRgba.rows,
    );
    outCtx.putImageData(outImageData, 0, 0);
    outRgba.delete();

    return await out.convertToBlob({ type: 'image/png' });
  } finally {
    src.delete();
    gray.delete();
    filtered.delete();
    edges.delete();
    closed.delete();
    inverted.delete();
    kernel?.delete();
  }
}

// 워커 spawn 시점에 백그라운드로 OpenCV 로드 시작 (warm-up)
void loadCV().catch((err) => {
  console.error('[outline-worker] cv load failed:', err);
});
