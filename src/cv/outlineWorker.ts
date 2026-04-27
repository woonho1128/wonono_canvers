/**
 * 사진 → 외곽선 Web Worker (설계서 6.4.4)
 *
 * 메시지 프로토콜:
 *  in:  { type: 'convert', imageBitmap: ImageBitmap, detail: number }
 *  out: { type: 'result', blob: Blob } | { type: 'error', message: string }
 *
 * 메인 스레드는 worker가 처리하는 동안 UI 응답성 유지.
 *
 * TODO: 5주차 구현.
 */

export interface OutlineWorkerRequest {
  type: 'convert';
  imageBitmap: ImageBitmap;
  detail: number; // 0-200, 기본 100
}

export type OutlineWorkerResponse =
  | { type: 'result'; blob: Blob }
  | { type: 'error'; message: string };
