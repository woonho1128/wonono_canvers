/**
 * 외곽선 마스크 생성/캐시 (설계서 6.2.1)
 *
 * - 도안 PNG → Uint8Array(width*height): 0=빈, 1=외곽선
 * - 휘도 < 80 && alpha > 128 픽셀을 외곽선으로 판정
 * - 도안당 1회만 빌드, IndexedDB pages_cache에 저장
 *
 * TODO: 2주차 구현.
 */

export function buildOutlineMask(
  _image: HTMLImageElement,
  _width: number,
  _height: number,
): Uint8Array {
  // TODO
  throw new Error('not implemented');
}
