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
  const cannyEdges = new cv.Mat();
  const adaptiveEdges = new cv.Mat();
  const merged = new cv.Mat();
  const closed = new cv.Mat();
  const cleaned = new cv.Mat();
  const inverted = new cv.Mat();
  let closeKernel: any = null;
  let dilateKernel: any = null;

  try {
    cv.cvtColor(src, gray, cv.COLOR_RGBA2GRAY);
    // 엣지 보존 평탄화 (노이즈는 줄이고 강한 엣지는 유지)
    cv.bilateralFilter(gray, filtered, 7, 35, 35);

    // 1) Canny — 선명한 엣지(눈/입/옷 경계, 강한 윤곽선)
    const t1 = Math.max(20, 95 - detail * 0.4);
    const t2 = Math.max(55, 195 - detail * 0.7);
    cv.Canny(filtered, cannyEdges, t1, t2);

    // 2) Adaptive Threshold — 그라데이션 영역의 명암 경계 캡처
    //    (3D 애니/사진의 부드러운 셰이딩, 털 음영, 실루엣 등 Canny가 놓치는 부분)
    //    blockSize: 이미지 크기에 비례하는 홀수, C: detail 클수록 더 민감(작게)
    const blockSize = makeOdd(Math.max(7, Math.round(Math.min(w, h) / 80)));
    const cParam = Math.max(2, 10 - detail * 0.04);
    cv.adaptiveThreshold(
      filtered,
      adaptiveEdges,
      255,
      cv.ADAPTIVE_THRESH_MEAN_C,
      cv.THRESH_BINARY_INV,
      blockSize,
      cParam,
    );

    // 3) 두 결과를 OR 결합 — Canny의 선명한 엣지 + Adaptive의 면 경계
    cv.bitwise_or(cannyEdges, adaptiveEdges, merged);

    // 4) 모폴로지 정리: 작은 끊김 메우고(close) 살짝 두껍게(dilate)
    closeKernel = cv.getStructuringElement(cv.MORPH_RECT, new cv.Size(2, 2));
    dilateKernel = cv.getStructuringElement(cv.MORPH_ELLIPSE, new cv.Size(2, 2));
    cv.morphologyEx(merged, closed, cv.MORPH_CLOSE, closeKernel);
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
    gray.delete();
    filtered.delete();
    cannyEdges.delete();
    adaptiveEdges.delete();
    merged.delete();
    closed.delete();
    cleaned.delete();
    inverted.delete();
    closeKernel?.delete();
    dilateKernel?.delete();
  }
}

function makeOdd(n: number): number {
  return n % 2 === 0 ? n + 1 : n;
}

void loadCV().catch((err) => {
  console.error('[outline-worker] cv load failed:', err);
});
