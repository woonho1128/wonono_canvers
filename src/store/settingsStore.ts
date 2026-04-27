/**
 * 사용자 설정 (설계서 6.6)
 *
 * - soundEnabled: 효과음 on/off
 * - inputMode: Pointer/Palm Rejection 모드 (부모 메뉴 토글)
 *
 * IndexedDB settings store에서 hydrate, 변경 시 자동 persist.
 */

import { create } from 'zustand';
import type { InputMode } from '@/canvas/pointerController';
import { getDB } from '@/db/indexeddb';
import { setSoundEnabled as applySoundEnabled } from '@/audio/soundEffects';

interface SettingsState {
  soundEnabled: boolean;
  inputMode: InputMode;
  hydrated: boolean;
  setSoundEnabled: (v: boolean) => void;
  setInputMode: (m: InputMode) => void;
  hydrate: () => Promise<void>;
}

const SOUND_KEY = 'soundEnabled';
const INPUT_KEY = 'inputMode';

async function persist(key: string, value: unknown): Promise<void> {
  try {
    const db = await getDB();
    await db.put('settings', { key, value });
  } catch (err) {
    console.warn('settings persist failed:', err);
  }
}

export const useSettingsStore = create<SettingsState>((set, get) => ({
  soundEnabled: true,
  inputMode: 'auto',
  hydrated: false,

  setSoundEnabled: (soundEnabled) => {
    set({ soundEnabled });
    applySoundEnabled(soundEnabled);
    void persist(SOUND_KEY, soundEnabled);
  },

  setInputMode: (inputMode) => {
    set({ inputMode });
    void persist(INPUT_KEY, inputMode);
  },

  hydrate: async () => {
    if (get().hydrated) return;
    try {
      const db = await getDB();
      const sound = await db.get('settings', SOUND_KEY);
      const input = await db.get('settings', INPUT_KEY);
      const next: Partial<SettingsState> = { hydrated: true };
      if (sound && typeof sound.value === 'boolean') {
        next.soundEnabled = sound.value;
        applySoundEnabled(sound.value);
      }
      if (
        input &&
        (input.value === 'auto' || input.value === 'pen-only' || input.value === 'finger-only')
      ) {
        next.inputMode = input.value;
      }
      set(next);
    } catch (err) {
      console.warn('settings hydrate failed:', err);
      set({ hydrated: true });
    }
  },
}));
