import type { ReactNode } from 'react';
import type { AsyncState } from '@/hooks/useAsyncData';

interface AsyncBoundaryProps<T> {
  state: AsyncState<T>;
  children: (data: T) => ReactNode;
  loadingLabel?: string;
}

/**
 * 비동기 상태 → 5세 친화 fallback UI.
 * - loading: 큰 이모지 + 짧은 한글
 * - error: 안내 + 다시 시도 버튼 (retry는 부모가 처리)
 */
export function AsyncBoundary<T>({ state, children, loadingLabel = '잠깐만요...' }: AsyncBoundaryProps<T>) {
  if (state.status === 'loading') {
    return (
      <div className="grid place-items-center min-h-[40vh]">
        <div className="text-center">
          <div className="text-6xl animate-pulse">⏳</div>
          <p className="text-kid-body mt-4">{loadingLabel}</p>
        </div>
      </div>
    );
  }
  if (state.status === 'error') {
    return (
      <div className="grid place-items-center min-h-[40vh]">
        <div className="text-center">
          <div className="text-6xl">😢</div>
          <p className="text-kid-body mt-4">앗, 가져오지 못했어요</p>
          <p className="text-sm text-app-text/60 mt-2">{state.error.message}</p>
        </div>
      </div>
    );
  }
  return <>{children(state.data)}</>;
}
