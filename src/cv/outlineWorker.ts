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
  const subject = isolateSubject(src, w, h);
  suppressBorderBackground(subject, w, h);
  const gray = new cv.Mat();
  const filtered = new cv.Mat();
  const edges = new cv.Mat();
  const closed = new cv.Mat();
  const cleaned = new cv.Mat();
  const inverted = new cv.Mat();
  let closeKernel: any = null;
  let dilateKernel: any = null;

  try {
    cv.cvtColor(subject, gray, cv.COLOR_RGBA2GRAY);
    cv.bilateralFilter(gray, filtered, 7, 55, 55);

    const t1 = Math.max(40, 130 - detail * 0.45);
    const t2 = Math.max(95, 260 - detail * 0.75);
    cv.Canny(filtered, edges, t1, t2);

    closeKernel = cv.getStructuringElement(cv.MORPH_RECT, new cv.Size(2, 2));
    dilateKernel = cv.getStructuringElement(cv.MORPH_ELLIPSE, new cv.Size(2, 2));
    cv.morphologyEx(edges, closed, cv.MORPH_CLOSE, closeKernel);
    cv.dilate(closed, cleaned, dilateKernel);

    cv.bitwise_not(cleaned, inverted);

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
    subject.delete();
    gray.delete();
    filtered.delete();
    edges.delete();
    closed.delete();
    cleaned.delete();
    inverted.delete();
    closeKernel?.delete();
    dilateKernel?.delete();
  }
}

function isolateSubject(src: any, width: number, height: number): any {
  const subject = src.clone();
  if (typeof cv.grabCut !== 'function') return subject;

  const rgb = new cv.Mat();
  const mask = new cv.Mat();
  const bgdModel = new cv.Mat();
  const fgdModel = new cv.Mat();

  try {
    cv.cvtColor(src, rgb, cv.COLOR_RGBA2RGB);

    const marginX = Math.max(1, Math.round(width * 0.06));
    const marginY = Math.max(1, Math.round(height * 0.04));
    const rect = new cv.Rect(marginX, marginY, width - marginX * 2, height - marginY * 2);

    cv.grabCut(rgb, mask, rect, bgdModel, fgdModel, 3, cv.GC_INIT_WITH_RECT);

    const pixels = subject.data;
    const maskData = mask.data;
    for (let i = 0, p = 0; i < maskData.length; i += 1, p += 4) {
      const m = maskData[i];
      if (m === cv.GC_BGD || m === cv.GC_PR_BGD) {
        pixels[p] = 255;
        pixels[p + 1] = 255;
        pixels[p + 2] = 255;
        pixels[p + 3] = 255;
      }
    }

    return subject;
  } catch (err) {
    console.warn('[outline-worker] foreground isolation skipped:', err);
    return subject;
  } finally {
    rgb.delete();
    mask.delete();
    bgdModel.delete();
    fgdModel.delete();
  }
}

// 워커 spawn 시점에 백그라운드로 OpenCV 로드 시작 (warm-up)
function suppressBorderBackground(mat: any, width: number, height: number): void {
  const data = mat.data as Uint8ClampedArray;
  const samples: number[] = [];
  const step = Math.max(1, Math.floor(Math.min(width, height) / 80));

  for (let x = 0; x < width; x += step) {
    pushPixel(samples, data, x, 0, width);
    pushPixel(samples, data, x, height - 1, width);
  }
  for (let y = 0; y < height; y += step) {
    pushPixel(samples, data, 0, y, width);
    pushPixel(samples, data, width - 1, y, width);
  }

  if (samples.length === 0) return;

  let r = 0;
  let g = 0;
  let b = 0;
  const count = samples.length / 3;
  for (let i = 0; i < samples.length; i += 3) {
    r += samples[i];
    g += samples[i + 1];
    b += samples[i + 2];
  }
  r /= count;
  g /= count;
  b /= count;

  const colorThresholdSq = 205 * 205;
  for (let p = 0; p < data.length; p += 4) {
    const dr = data[p] - r;
    const dg = data[p + 1] - g;
    const db = data[p + 2] - b;
    const isBorderLike = dr * dr + dg * dg + db * db < colorThresholdSq;

    if (isBorderLike) {
      data[p] = 255;
      data[p + 1] = 255;
      data[p + 2] = 255;
      data[p + 3] = 255;
    }
  }
}

function pushPixel(
  samples: number[],
  data: Uint8ClampedArray,
  x: number,
  y: number,
  width: number,
): void {
  const p = (y * width + x) * 4;
  samples.push(data[p], data[p + 1], data[p + 2]);
}

void loadCV().catch((err) => {
  console.error('[outline-worker] cv load failed:', err);
});
