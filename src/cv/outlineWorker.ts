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
  const rgb = new cv.Mat();
  const smooth = new cv.Mat();
  const gray = new cv.Mat();
  const denoised = new cv.Mat();
  const edges = new cv.Mat();
  const closed = new cv.Mat();
  const cleaned = new cv.Mat();
  const inverted = new cv.Mat();
  let closeKernel: any = null;
  let dilateKernel: any = null;

  try {
    // 1) 가벼운 cartoonize: bilateral 1회 (d=7, σ=45) — 미세 텍스처는
    //    부드럽게, 강한 엣지는 보존. 너무 강하게 평탄화하면 부드러운
    //    실루엣까지 사라지므로 보수적으로.
    cv.cvtColor(src, rgb, cv.COLOR_RGBA2RGB);
    cv.bilateralFilter(rgb, smooth, 7, 45, 45);

    // 2) 그레이스케일 + 미디언 블러로 잔여 점 잡음 제거
    cv.cvtColor(smooth, gray, cv.COLOR_RGB2GRAY);
    cv.medianBlur(gray, denoised, 3);

    // 3) Canny — 약한 엣지까지 잡도록 하한을 낮게.
    //    detail=100 기준 t1≈25, t2≈55 → 부드러운 윤곽도 캡처.
    //    detail이 높을수록 더 민감하게.
    const t1 = Math.max(10, 70 - detail * 0.45);
    const t2 = Math.max(30, 145 - detail * 0.9);
    cv.Canny(denoised, edges, t1, t2);

    // 4) 모폴로지: close로 끊김 메우고, dilate로 약한 두께
    closeKernel = cv.getStructuringElement(cv.MORPH_ELLIPSE, new cv.Size(3, 3));
    dilateKernel = cv.getStructuringElement(cv.MORPH_ELLIPSE, new cv.Size(2, 2));
    cv.morphologyEx(edges, closed, cv.MORPH_CLOSE, closeKernel);
    cv.dilate(closed, cleaned, dilateKernel);

    // 5) 반전 (엣지=검정, 배경=흰색)
    cv.bitwise_not(cleaned, inverted);

    const out = new OffscreenCanvas(w, h);
    const outCtx = out.getContext('2d');
    if (!outCtx) throw new Error('OffscreenCanvas 2D context unavailable');

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
    rgb.delete();
    smooth.delete();
    gray.delete();
    denoised.delete();
    edges.delete();
    closed.delete();
    cleaned.delete();
    inverted.delete();
    closeKernel?.delete();
    dilateKernel?.delete();
  }
}

void loadCV().catch((err) => {
  console.error('[outline-worker] cv load failed:', err);
});
