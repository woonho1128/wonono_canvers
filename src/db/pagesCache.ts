/**
 * 도안 + 외곽선 마스크 캐시 (설계서 6.5.1)
 *
 * 도안을 처음 열 때만 Storage에서 받아 마스크 빌드 → 캐시.
 * 두번째부터는 IndexedDB에서 즉시 로드.
 */

import { getDB, type PageCacheRecord } from './indexeddb';

export async function getCachedPage(pageId: string): Promise<PageCacheRecord | undefined> {
  const db = await getDB();
  return db.get('pages_cache', pageId);
}

export async function putCachedPage(record: PageCacheRecord): Promise<void> {
  const db = await getDB();
  await db.put('pages_cache', record);
}

export async function deleteCachedPage(pageId: string): Promise<void> {
  const db = await getDB();
  await db.delete('pages_cache', pageId);
}
