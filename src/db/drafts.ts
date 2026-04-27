/**
 * 자동저장 — 미완성 캔버스 (설계서 6.5.3)
 *
 * stroke 종료마다 debounce(500ms)로 호출.
 * 작품 "💾 저장" 시점에 해당 draft 삭제.
 */

import { getDB, type DraftRecord } from './indexeddb';

export async function saveDraft(record: DraftRecord): Promise<void> {
  const db = await getDB();
  await db.put('drafts', record);
}

export async function loadDraft(pageId: string): Promise<DraftRecord | undefined> {
  const db = await getDB();
  return db.get('drafts', pageId);
}

export async function deleteDraft(pageId: string): Promise<void> {
  const db = await getDB();
  await db.delete('drafts', pageId);
}

export async function listDrafts(): Promise<DraftRecord[]> {
  const db = await getDB();
  return db.getAll('drafts');
}
