/**
 * Pointer 통합 + Palm Rejection (설계서 6.1.2)
 *
 * 동작 매트릭스:
 *  - pointerType === 'pen'      → 항상 통과, penLastSeenAt 갱신
 *  - pointerType === 'mouse'    → 통과 (개발/디버그)
 *  - pointerType === 'touch'    → pen 활성 5초 윈도우면 무시 (palm rejection)
 *  - 멀티터치 (다른 활성 포인터 진입) → 현재 stroke 즉시 취소
 *  - pointercancel              → 현재 stroke 폐기
 *  - setPointerCapture          → 캔버스 밖으로 나가도 추적 유지
 *
 * 부모 메뉴 입력 모드:
 *  - 'auto'         (기본) — 위 매트릭스
 *  - 'pen-only'     — pen만 받음
 *  - 'finger-only'  — pen은 무시
 */

export type InputMode = 'auto' | 'pen-only' | 'finger-only';

export interface PointerPoint {
  x: number;
  y: number;
}

export interface PointerControllerCallbacks {
  onStrokeStart(point: PointerPoint, e: PointerEvent): void;
  onStrokeMove(point: PointerPoint, e: PointerEvent): void;
  onStrokeEnd(point: PointerPoint, e: PointerEvent): void;
  onStrokeCancel(): void;
}

const PEN_PALM_REJECT_WINDOW_MS = 5000;

export class PointerController {
  private mode: InputMode = 'auto';
  private activePointerId: number | null = null;
  private penLastSeenAt = 0;
  private destroyed = false;

  constructor(
    private canvas: HTMLCanvasElement,
    private callbacks: PointerControllerCallbacks,
  ) {
    canvas.addEventListener('pointerdown', this.onPointerDown);
    canvas.addEventListener('pointermove', this.onPointerMove);
    canvas.addEventListener('pointerup', this.onPointerUp);
    canvas.addEventListener('pointercancel', this.onPointerCancel);
    canvas.addEventListener('pointerleave', this.onPointerLeave);
  }

  setMode(mode: InputMode): void {
    if (this.mode === mode) return;
    this.mode = mode;
    // 모드 변경 시 진행 중 stroke는 안전하게 취소
    if (this.activePointerId !== null) this.cancelCurrentStroke();
  }

  destroy(): void {
    if (this.destroyed) return;
    this.destroyed = true;
    this.canvas.removeEventListener('pointerdown', this.onPointerDown);
    this.canvas.removeEventListener('pointermove', this.onPointerMove);
    this.canvas.removeEventListener('pointerup', this.onPointerUp);
    this.canvas.removeEventListener('pointercancel', this.onPointerCancel);
    this.canvas.removeEventListener('pointerleave', this.onPointerLeave);
    if (this.activePointerId !== null) this.cancelCurrentStroke();
  }

  // ============== Event handlers ==============

  private onPointerDown = (e: PointerEvent) => {
    if (e.pointerType === 'pen') this.penLastSeenAt = Date.now();

    if (!this.shouldAccept(e)) return;

    // 이미 다른 포인터로 그리는 중이면 멀티터치 → 현재 stroke 취소하고 새 stroke 시작 안 함
    if (this.activePointerId !== null && this.activePointerId !== e.pointerId) {
      this.cancelCurrentStroke();
      return;
    }

    this.activePointerId = e.pointerId;
    try {
      this.canvas.setPointerCapture(e.pointerId);
    } catch {
      // 일부 브라우저는 throw — 무시
    }
    this.callbacks.onStrokeStart(this.toPoint(e), e);
  };

  private onPointerMove = (e: PointerEvent) => {
    if (e.pointerType === 'pen') this.penLastSeenAt = Date.now();
    if (e.pointerId !== this.activePointerId) return;

    // 빠른 손동작 시 한 frame 안에 다수 sample이 합쳐져 들어오면 부드러움이 깨짐.
    // getCoalescedEvents()로 중간 sample을 모두 풀어내 stroke 곡선의 정밀도를 올림.
    const coalesced =
      typeof e.getCoalescedEvents === 'function' ? e.getCoalescedEvents() : null;
    if (coalesced && coalesced.length > 1) {
      for (const sub of coalesced) {
        this.callbacks.onStrokeMove(this.toPoint(sub), sub);
      }
    } else {
      this.callbacks.onStrokeMove(this.toPoint(e), e);
    }
  };

  private onPointerUp = (e: PointerEvent) => {
    if (e.pointerId !== this.activePointerId) return;
    this.callbacks.onStrokeEnd(this.toPoint(e), e);
    this.releaseAndClear(e.pointerId);
  };

  private onPointerCancel = (e: PointerEvent) => {
    if (e.pointerId !== this.activePointerId) return;
    this.cancelCurrentStroke();
    this.releaseAndClear(e.pointerId);
  };

  // pointer가 캔버스 밖으로 나간 경우는 setPointerCapture 덕분에 보통 leave가 발생하지 않음.
  // 만약 capture 실패한 경우(브라우저 호환) leave를 stroke 종료로 처리.
  private onPointerLeave = (e: PointerEvent) => {
    if (e.pointerId !== this.activePointerId) return;
    if (this.canvas.hasPointerCapture(e.pointerId)) return; // capture 살아있으면 leave 무시
    this.callbacks.onStrokeEnd(this.toPoint(e), e);
    this.activePointerId = null;
  };

  // ============== Helpers ==============

  private shouldAccept(e: PointerEvent): boolean {
    if (this.mode === 'pen-only') return e.pointerType === 'pen';
    if (this.mode === 'finger-only') return e.pointerType !== 'pen';

    // auto: pen이 활성 5초 윈도우면 touch 거부 (Palm Rejection)
    if (e.pointerType === 'touch' && this.isPenActive()) return false;
    return true;
  }

  private isPenActive(): boolean {
    return Date.now() - this.penLastSeenAt < PEN_PALM_REJECT_WINDOW_MS;
  }

  private cancelCurrentStroke(): void {
    if (this.activePointerId === null) return;
    this.callbacks.onStrokeCancel();
    this.activePointerId = null;
  }

  private releaseAndClear(pointerId: number): void {
    if (this.canvas.hasPointerCapture(pointerId)) {
      try {
        this.canvas.releasePointerCapture(pointerId);
      } catch {
        // ignore
      }
    }
    this.activePointerId = null;
  }

  private toPoint(e: PointerEvent): PointerPoint {
    const rect = this.canvas.getBoundingClientRect();
    return { x: e.clientX - rect.left, y: e.clientY - rect.top };
  }
}
