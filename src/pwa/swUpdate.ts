import { registerSW } from 'virtual:pwa-register';

/**
 * Service Worker 업데이트 정책 (설계서 10.3)
 *
 * - skipWaiting() 호출하지 않음
 * - 그리는 중에는 활성화 금지 (캔버스 상태 유실 방지)
 * - 안전한 시점(홈 진입 등)에 applyUpdateIfSafe() 호출
 */

let pendingUpdate: (() => Promise<void>) | null = null;
let isDrawing = false;
const listeners = new Set<(hasUpdate: boolean) => void>();

export function initServiceWorker(): void {
  if (!('serviceWorker' in navigator)) return;

  const updateSW = registerSW({
    onNeedRefresh() {
      // waiting SW가 생겼다 — 즉시 적용 X, 안전한 시점까지 대기
      pendingUpdate = async () => {
        await updateSW(true);
      };
      notifyListeners(true);
      tryApplyIfSafe();
    },
    onOfflineReady() {
      // 오프라인 준비 완료 (5세에게는 노출하지 않음)
    },
    onRegisterError(err) {
      console.warn('[SW] register failed:', err);
    },
  });
}

export function setIsDrawing(drawing: boolean): void {
  isDrawing = drawing;
  if (!drawing) tryApplyIfSafe();
}

export function applyUpdateIfSafe(): void {
  tryApplyIfSafe();
}

export function hasPendingUpdate(): boolean {
  return pendingUpdate !== null;
}

export function subscribeUpdateStatus(listener: (hasUpdate: boolean) => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

function tryApplyIfSafe(): void {
  if (!pendingUpdate || isDrawing) return;
  const apply = pendingUpdate;
  pendingUpdate = null;
  void apply();
}

function notifyListeners(hasUpdate: boolean): void {
  for (const l of listeners) l(hasUpdate);
}
