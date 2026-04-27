import { Link, useParams } from 'react-router-dom';
import { useEffect, useRef } from 'react';
import { useAsyncData } from '@/hooks/useAsyncData';
import { AsyncBoundary } from '@/components/AsyncBoundary';
import { getPageById } from '@/supabase/pages';
import { publicUrl } from '@/supabase/storage';
import { setupCanvas } from '@/canvas/CanvasEngine';
import type { ColoringPage } from '@/supabase/types';

export default function ColoringScreen() {
  const { pageId } = useParams<{ pageId: string }>();
  const state = useAsyncData(() => {
    if (!pageId) throw new Error('도안 ID가 없어요');
    return getPageById(pageId).then((p) => {
      if (!p) throw new Error('도안을 찾을 수 없어요');
      return p;
    });
  }, [pageId]);

  return (
    <div className="h-full flex flex-col bg-app-bg">
      <Header />
      <AsyncBoundary state={state} loadingLabel="도안 가져오는 중...">
        {(page) => <CanvasArea page={page} />}
      </AsyncBoundary>
      <Footer />
    </div>
  );
}

function Header() {
  return (
    <header className="h-touch-lg shrink-0 flex items-center px-4 gap-2 border-b border-black/10">
      <Link to="/" className="kid-btn bg-white px-6">
        🏠
      </Link>
      <div className="flex-1" />
      <button className="kid-btn bg-white px-6 opacity-40" disabled aria-label="되돌리기 (V2)">
        ↩️
      </button>
      <button className="kid-btn bg-white px-6 opacity-40" disabled aria-label="다시하기 (V2)">
        ↪️
      </button>
      <button className="kid-btn bg-app-orange text-white px-6 opacity-40" disabled aria-label="저장 (V2)">
        💾
      </button>
    </header>
  );
}

function Footer() {
  return (
    <footer className="shrink-0 border-t border-black/10">
      <div className="h-touch-lg flex items-center gap-2 px-4 overflow-x-auto">
        <span className="text-sm text-app-text/40">V2: 색상 팔레트</span>
      </div>
      <div className="h-touch-lg flex items-center gap-2 px-4">
        <span className="text-sm text-app-text/40">V2: 도구 (붓 / 물통 / 지우개)</span>
      </div>
    </footer>
  );
}

function CanvasArea({ page }: { page: ColoringPage }) {
  const containerRef = useRef<HTMLDivElement>(null);
  const paintCanvasRef = useRef<HTMLCanvasElement>(null);
  const outlineCanvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const container = containerRef.current;
    const paintCanvas = paintCanvasRef.current;
    const outlineCanvas = outlineCanvasRef.current;
    if (!container || !paintCanvas || !outlineCanvas) return;

    const rect = container.getBoundingClientRect();
    const size = Math.floor(Math.min(rect.width, rect.height));
    if (size <= 0) return;

    setupCanvas(paintCanvas, size, size);
    const outlineCtx = setupCanvas(outlineCanvas, size, size);

    const img = new Image();
    img.crossOrigin = 'anonymous';
    let cancelled = false;

    img.onload = () => {
      if (cancelled) return;
      outlineCtx.clearRect(0, 0, size, size);
      outlineCtx.drawImage(img, 0, 0, size, size);
    };
    img.onerror = () => {
      if (cancelled) return;
      // 5세에게는 보이지 않도록 fallback — 캔버스 비워둠
      outlineCtx.clearRect(0, 0, size, size);
    };
    img.src = publicUrl('outlines', page.outline_path);

    return () => {
      cancelled = true;
    };
  }, [page]);

  return (
    <main className="flex-1 grid place-items-center p-4 min-h-0 overflow-hidden">
      <div
        ref={containerRef}
        className="relative aspect-square w-full max-h-full max-w-full bg-white rounded-2xl shadow-sm"
        style={{ height: 'min(100%, 100vw)' }}
      >
        <canvas ref={paintCanvasRef} className="absolute inset-0 w-full h-full rounded-2xl" />
        <canvas
          ref={outlineCanvasRef}
          className="absolute inset-0 w-full h-full rounded-2xl pointer-events-none"
        />
      </div>
    </main>
  );
}
