/**
 * Pointer 통합 + Palm Rejection (설계서 6.1.2)
 *
 * - pen 활성 5초 윈도우 동안 touch 무시
 * - 멀티터치 진입 시 현재 stroke 취소
 * - pointercancel 시 stroke 폐기
 * - setPointerCapture로 캔버스 밖 추적
 *
 * 부모 메뉴에서 입력 모드 전환 가능: 'auto' | 'pen-only' | 'finger-only'
 *
 * TODO: 4주차 구현.
 */

export type InputMode = 'auto' | 'pen-only' | 'finger-only';

export interface PointerControllerCallbacks {
  onStrokeStart(e: PointerEvent): void;
  onStrokeMove(e: PointerEvent): void;
  onStrokeEnd(e: PointerEvent): void;
  onStrokeCancel(): void;
}

export class PointerController {
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  constructor(_canvas: HTMLCanvasElement, _callbacks: PointerControllerCallbacks) {
    // TODO
  }

  setMode(_mode: InputMode): void {
    // TODO
  }

  destroy(): void {
    // TODO
  }
}
