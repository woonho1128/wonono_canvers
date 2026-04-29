/**
 * Service Worker 업데이트 (단순화 버전)
 *
 * 이전: 'prompt' 모드 + 수동 applyUpdateIfSafe 호출. 그러나 호출 지점이 없어
 *       새 SW가 활성화되지 않는 버그가 있었음.
 * 현재: vite.config.ts 의 registerType: 'autoUpdate' 가 SW 자체에서
 *       skipWaiting + clientsClaim 처리하므로 본 파일은 호환을 위한 stub.
 *
 * `injectRegister: 'auto'` 가 가상 모듈을 자동 등록하므로 별도 register 호출도 불필요.
 */

export function initServiceWorker(): void {
  // no-op: vite-plugin-pwa autoUpdate 가 등록·갱신을 모두 처리.
}

// 캔버스 상태 손실 방지용 hook 들이 외부에서 import 되어 있을 수 있어 stub 유지.
export function setIsDrawing(_drawing: boolean): void {
  // no-op
}

export function applyUpdateIfSafe(): void {
  // no-op
}

export function hasPendingUpdate(): boolean {
  return false;
}

export function subscribeUpdateStatus(_listener: (hasUpdate: boolean) => void): () => void {
  return () => {};
}
