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
  const smooth1 = new cv.Mat();
  const smooth2 = new cv.Mat();
  const gray = new cv.Mat();
  const denoised = new cv.Mat();
  const edges = new cv.Mat();
  const closed = new cv.Mat();
  const cleaned = new cv.Mat();
  const inverted = new cv.Mat();
  let closeKernel: any = null;
  let dilateKernel: any = null;

  try {
    // 1) Cartoonize: bilateral filter 2회 패스로 색 영역을 평탄화.
    //    그라데이션이 단색 면으로 합쳐져, 면 사이의 경계가 강한 엣지로 변함.
    //    이 과정 없이 adaptive threshold를 쓰면 셰이딩이 텍스처/스티플링으로
    //    잡혀 도안이 지저분해짐.
    cv.cvtColor(src, rgb, cv.COLOR_RGBA2RGB);
    cv.bilateralFilter(rgb, smooth1, 9, 80, 80);
    cv.bilateralFilter(smooth1, smooth2, 9, 80, 80);

    // 2) 그레이스케일 + 미디언 블러로 잔여 잡음 제거
    cv.cvtColor(smooth2, gray, cv.COLOR_RGB2GRAY);
    cv.medianBlur(gray, denoised, 3);

    // 3) Canny — 단순화된 이미지에서는 면 사이 경계가 깔끔하게 잡힘
    //    detail이 클수록 더 약한 엣지까지 캡처 (하한 낮아짐)
    const t1 = Math.max(25, 100 - detail * 0.45);
    const t2 = Math.max(70, 200 - detail * 0.7);
    cv.Canny(denoised, edges, t1, t2);

    // 4) 모폴로지: close로 끊김 메우고, dilate로 약한 두께
    closeKernel = cv.getStructuringElement(cv.MORPH_RECT, new cv.Size(2, 2));
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
    smooth1.delete();
    smooth2.delete();
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
