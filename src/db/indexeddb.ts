/**
 * IndexedDB 래퍼 (설계서 6.5.2)
 *
 * 3개의 object store:
 *  - drafts: 작업 중인 미완성 캔버스 (Blob)
 *  - pages_cache: 다운로드한 도안 + 외곽선 마스크
 *  - settings: 효과음/입력 모드 등 사용자 설정
 */

import { openDB, type DBSchema, type IDBPDatabase } from 'idb';

export interface DraftRecord {
  pageId: string;
  canvasBlob: Blob;
  savedAt: number;
  strokeCount: number;
}

export interface PageCacheRecord {
  pageId: string;
  outlineBlob: Blob;
  maskBytes: ArrayBuffer; // Uint8Array.buffer
  width: number;
  height: number;
  cachedAt: number;
}

export interface SettingsRecord {
  key: string;
  value: unknown;
}

interface KidPaintDB extends DBSchema {
  drafts: { key: string; value: DraftRecord };
  pages_cache: { key: string; value: PageCacheRecord };
  settings: { key: string; value: SettingsRecord };
}

let dbPromise: Promise<IDBPDatabase<KidPaintDB>> | null = null;

export function getDB(): Promise<IDBPDatabase<KidPaintDB>> {
  if (!dbPromise) {
    dbPromise = openDB<KidPaintDB>('kidpaint', 1, {
      upgrade(db) {
        db.createObjectStore('drafts', { keyPath: 'pageId' });
        db.createObjectStore('pages_cache', { keyPath: 'pageId' });
        db.createObjectStore('settings', { keyPath: 'key' });
      },
    });
  }
  return dbPromise;
}
