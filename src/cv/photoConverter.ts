/**
 * 사진 → 외곽선 도안 변환 (메인 스레드 API).
 *
 * 실제 처리는 outlineWorker(클래식 Web Worker)에서 실행되어
 * UI 응답성을 유지한다.
 *
 * 결과 한계 (설계서 6.4.1): 단순 만화/사물 OK, 털·복잡 배경 X.
 * UI에서 "별로예요" 폐기 흐름 필수.
 */

import { createId } from '@/utils/id';

let workerInstance: Worker | null = null;
let workerReady = false;
const readyListeners = new Set<() => void>();

function getWorker(): Worker {
  if (!workerInstance) {
    workerInstance = new Worker(new URL('./outlineWorker.ts', import.meta.url), {
      type: 'classic',
    });
    workerInstance.addEventListener('message', (e: MessageEvent) => {
      if (e.data?.type === 'ready') {
        workerReady = true;
        for (const l of readyListeners) l();
        readyListeners.clear();
      }
    });
  }
  return workerInstance;
}

/**
 * Worker를 미리 띄워 OpenCV.js 다운로드/wasm 컴파일을 백그라운드로 시작.
 * PhotoToOutline 페이지 진입 시점에 호출 권장.
 */
export function warmupConverter(): void {
  getWorker();
}

export function isConverterReady(): boolean {
  return workerReady;
}

export function onConverterReady(cb: () => void): () => void {
  if (workerReady) {
    cb();
    return () => {};
  }
  readyListeners.add(cb);
  return () => readyListeners.delete(cb);
}

export async function convertPhotoToOutline(
  source: HTMLImageElement | HTMLCanvasElement | ImageBitmap | Blob,
  detail: number = 100,
): Promise<Blob> {
  const bitmap = source instanceof ImageBitmap ? source : await createImageBitmap(source);
  const id = createId();
  const worker = getWorker();

  return new Promise<Blob>((resolve, reject) => {
    const handler = (e: MessageEvent) => {
      if (e.data?.id !== id) return;
      worker.removeEventListener('message', handler);
      if (e.data.type === 'result') resolve(e.data.blob);
      else reject(new Error(e.data.message ?? 'unknown error'));
    };
    worker.addEventListener('message', handler);
    worker.postMessage({ type: 'convert', id, bitmap, detail }, [bitmap]);
  });
}

export async function fileToImage(file: File): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error('이미지 디코드 실패'));
    };
    img.src = url;
  });
}
