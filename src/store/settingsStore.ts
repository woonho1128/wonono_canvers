/**
 * 사용자 설정 (설계서 6.6)
 *
 * - soundEnabled: 효과음 on/off (홈 우상단 음소거 버튼)
 * - inputMode: Pointer/Palm Rejection 모드 (부모 메뉴 토글)
 *
 * IndexedDB settings store에서 hydrate.
 */

import { create } from 'zustand';
import type { InputMode } from '@/canvas/pointerController';

interface SettingsState {
  soundEnabled: boolean;
  inputMode: InputMode;
  hydrated: boolean;
  setSoundEnabled: (v: boolean) => void;
  setInputMode: (m: InputMode) => void;
  markHydrated: () => void;
}

export const useSettingsStore = create<SettingsState>((set) => ({
  soundEnabled: true,
  inputMode: 'auto',
  hydrated: false,
  setSoundEnabled: (soundEnabled) => set({ soundEnabled }),
  setInputMode: (inputMode) => set({ inputMode }),
  markHydrated: () => set({ hydrated: true }),
}));
