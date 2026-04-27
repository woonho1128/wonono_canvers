/**
 * OpenCV.js 동적 로더 (설계서 6.4.5)
 *
 * - 메인 번들에 포함하지 않음 (~10MB)
 * - PhotoToOutline 진입 시점에만 다운로드
 * - Service Worker가 받은 wasm을 CacheFirst 캐싱 (vite.config.ts runtimeCaching)
 *
 * 자체 호스팅: `public/cv/opencv.js` — `npm run fetch:opencv`로 다운로드.
 *
 * 사용:
 *   const cv = await loadOpenCV();
 *   const src = cv.imread(canvas);
 *   ...
 */

// OpenCV.js의 'cv' API는 매우 광범위하고 자체 타입이 모호하므로
// 호출처에서 좁혀 사용한다.
export type Cv = unknown;

declare global {
  interface Window {
    cv?: Cv & {
      onRuntimeInitialized?: () => void;
      Mat?: unknown;
    };
    Module?: { onRuntimeInitialized?: () => void };
  }
}

const SCRIPT_PATH = '/cv/opencv.js';
let loadingPromise: Promise<Cv> | null = null;

export function loadOpenCV(): Promise<Cv> {
  if (loadingPromise) return loadingPromise;
  loadingPromise = new Promise<Cv>((resolve, reject) => {
    if (window.cv && (window.cv as { Mat?: unknown }).Mat) {
      resolve(window.cv);
      return;
    }
    const script = document.createElement('script');
    script.src = SCRIPT_PATH;
    script.async = true;

    const ready = () => resolve(window.cv as Cv);

    script.onerror = () => {
      loadingPromise = null;
      reject(new Error(`Failed to load ${SCRIPT_PATH}. 'npm run fetch:opencv'를 실행하셨나요?`));
    };

    script.onload = () => {
      const cv = window.cv as { Mat?: unknown; onRuntimeInitialized?: () => void } | undefined;
      if (!cv) {
        loadingPromise = null;
        reject(new Error('opencv.js loaded but global cv missing'));
        return;
      }
      if (cv.Mat) {
        // 이미 ready
        ready();
      } else {
        cv.onRuntimeInitialized = () => ready();
      }
    };

    document.head.appendChild(script);
  });
  return loadingPromise;
}

export function isOpenCVLoaded(): boolean {
  return Boolean(window.cv && (window.cv as { Mat?: unknown }).Mat);
}
