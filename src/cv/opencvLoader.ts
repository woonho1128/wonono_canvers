/**
 * OpenCV.js 동적 로더 (설계서 6.4.5)
 *
 * - 메인 번들에 포함하지 않음 (~8MB)
 * - 사진 변환 화면 진입 시점에만 다운로드
 * - Service Worker가 받은 wasm을 CacheFirst 캐싱 (vite.config.ts)
 *
 * 호스팅 옵션:
 *  - 옵션 A: opencv.js를 public/cv/opencv.js에 두고 자체 호스팅 (권장)
 *  - 옵션 B: docs.opencv.org CDN (CORS 필요, 느릴 수 있음)
 *
 * TODO: 5주차 구현.
 */

// OpenCV.js의 'cv' 전역은 자체 타입이 모호하므로 unknown으로 받고
// 실제 사용처에서 좁힌다.
let cvInstance: unknown = null;

export async function loadOpenCV(): Promise<unknown> {
  if (cvInstance) return cvInstance;
  // TODO: <script src="/cv/opencv.js"> 동적 삽입 + cv['onRuntimeInitialized'] 대기
  throw new Error('not implemented');
}
