/**
 * 효과음 시스템 (설계서 6.6)
 *
 * iOS autoplay 정책: 첫 사용자 인터랙션에서 unlock 필요.
 * Howler가 자체적으로 처리하지만, 첫 진입 시 의도된 탭에서 호출 권장.
 *
 * TODO: 6주차 구현. 사운드 파일은 public/sounds/.
 */

import { Howl } from 'howler';

export type SoundId = 'pickColor' | 'fill' | 'save' | 'undo' | 'reset' | 'home';

const sources: Record<SoundId, string> = {
  pickColor: '/sounds/pick-color.mp3',
  fill: '/sounds/fill.mp3',
  save: '/sounds/save.mp3',
  undo: '/sounds/undo.mp3',
  reset: '/sounds/reset.mp3',
  home: '/sounds/home.mp3',
};

const cache = new Map<SoundId, Howl>();
let enabled = true;

export function setSoundEnabled(v: boolean): void {
  enabled = v;
}

export function play(_id: SoundId): void {
  if (!enabled) return;
  // TODO: lazy create + play. 사운드 파일 추가 전에는 noop.
}

export function preload(_ids: SoundId[]): void {
  // TODO
  void cache;
  void sources;
}
