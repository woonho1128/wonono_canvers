import { useEffect, useState } from 'react';

export type AsyncState<T> =
  | { status: 'loading' }
  | { status: 'error'; error: Error }
  | { status: 'success'; data: T };

interface VersionedState<T> {
  // 현재 deps 키 (deps 배열을 직렬화한 캐시 키)
  key: string;
  state: AsyncState<T>;
}

/**
 * 1회성 비동기 데이터 로더.
 *
 * - 컴포넌트 unmount 후 setState 방지
 * - deps 변경 시 자동 재요청
 * - deps 직렬화 키로 stale 결과 무시 (race condition 차단)
 *
 * 캐싱·재시도가 필요해지면 React Query로 교체 검토.
 */
export function useAsyncData<T>(fetcher: () => Promise<T>, deps: unknown[]): AsyncState<T> {
  const key = JSON.stringify(deps);
  const [versioned, setVersioned] = useState<VersionedState<T>>({
    key,
    state: { status: 'loading' },
  });

  useEffect(() => {
    let cancelled = false;
    fetcher()
      .then((data) => {
        if (cancelled) return;
        setVersioned({ key, state: { status: 'success', data } });
      })
      .catch((err: unknown) => {
        if (cancelled) return;
        const error = err instanceof Error ? err : new Error(String(err));
        setVersioned({ key, state: { status: 'error', error } });
      });
    return () => {
      cancelled = true;
    };
    // fetcher는 매 렌더마다 새 함수일 수 있으므로 의도적으로 deps에서 제외.
    // 진실의 원천은 사용자가 명시한 deps(→ key).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);

  // deps가 바뀌었지만 새 fetch 가 아직 끝나지 않은 시점이면 loading으로 강제
  if (versioned.key !== key) {
    return { status: 'loading' };
  }
  return versioned.state;
}
