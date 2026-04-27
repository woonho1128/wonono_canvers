import { Link, useNavigate, useParams } from 'react-router-dom';
import { useCallback, useEffect, useRef, useState, type PointerEvent as ReactPointerEvent } from 'react';
import { useAsyncData } from '@/hooks/useAsyncData';
import { AsyncBoundary } from '@/components/AsyncBoundary';
import { ColorPalette } from '@/components/ColorPalette';
import { PAINT_COLORS, type PaintColor } from '@/components/paintColors';
import { BrushSizePicker } from '@/components/BrushSizePicker';
import { BRUSH_SIZES, type BrushSizeKey } from '@/components/brushSizes';
import { ToolBar } from '@/components/ToolBar';
import { CanvasEngine, type EngineState, type Tool } from '@/canvas/CanvasEngine';
import { getCanvasPoint } from '@/canvas/pointer';
import { getPageById } from '@/supabase/pages';
import { insertArtwork } from '@/supabase/artworks';
import { publicUrl, uploadBlob } from '@/supabase/storage';
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
      <AsyncBoundary state={state} loadingLabel="도안 가져오는 중...">
        {(page) => <Workspace page={page} />}
      </AsyncBoundary>
    </div>
  );
}

function Workspace({ page }: { page: ColoringPage }) {
  const navigate = useNavigate();
  const containerRef = useRef<HTMLDivElement>(null);
  const paintCanvasRef = useRef<HTMLCanvasElement>(null);
  const outlineCanvasRef = useRef<HTMLCanvasElement>(null);
  const engineRef = useRef<CanvasEngine | null>(null);

  const [tool, setTool] = useState<Tool>('brush');
  const [color, setColor] = useState<PaintColor>(PAINT_COLORS[0]);
  const [brushSize, setBrushSize] = useState<BrushSizeKey>('medium');
  const [engineState, setEngineState] = useState<EngineState>({
    canUndo: false,
    canRedo: false,
    isDirty: false,
  });
  const [saveState, setSaveState] = useState<'idle' | 'saving' | 'error'>('idle');

  // 엔진 셋업 + 외곽선 로드
  useEffect(() => {
    const container = containerRef.current;
    const paintCanvas = paintCanvasRef.current;
    const outlineCanvas = outlineCanvasRef.current;
    if (!container || !paintCanvas || !outlineCanvas) return;

    const rect = container.getBoundingClientRect();
    const size = Math.floor(Math.min(rect.width, rect.height));
    if (size <= 0) return;

    const engine = new CanvasEngine({
      paintCanvas,
      outlineCanvas,
      cssWidth: size,
      cssHeight: size,
    });
    engineRef.current = engine;
    engine.setColor(color.hex);
    engine.setBrushSize(BRUSH_SIZES[brushSize]);
    engine.setTool(tool);

    const unsubscribe = engine.subscribe(setEngineState);

    let cancelled = false;
    let objectUrl: string | null = null;
    const outlineUrl = publicUrl('outlines', page.outline_path);

    // dev: HTTP 캐시 우회로 SVG 수정 즉시 반영
    // prod: SW가 가로채 CacheFirst로 처리 (vite.config.ts runtimeCaching)
    fetch(outlineUrl, import.meta.env.DEV ? { cache: 'reload' } : undefined)
      .then((r) => r.blob())
      .then((blob) => {
        if (cancelled) return;
        objectUrl = URL.createObjectURL(blob);
        const img = new Image();
        img.onload = () => {
          if (!cancelled) engine.drawOutline(img);
          if (objectUrl) URL.revokeObjectURL(objectUrl);
        };
        img.src = objectUrl;
      })
      .catch((err) => console.error('outline fetch failed:', err));

    return () => {
      cancelled = true;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
      unsubscribe();
      engineRef.current = null;
    };
    // page.id 한 번만 셋업. tool/color/brushSize 변경은 별도 effect로 동기화.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page.id]);

  // 도구/색/굵기 변경 시 엔진에 반영
  useEffect(() => {
    engineRef.current?.setTool(tool);
  }, [tool]);
  useEffect(() => {
    engineRef.current?.setColor(color.hex);
  }, [color.hex]);
  useEffect(() => {
    engineRef.current?.setBrushSize(BRUSH_SIZES[brushSize]);
  }, [brushSize]);

  // Pointer 핸들러
  const onPointerDown = useCallback((e: ReactPointerEvent<HTMLCanvasElement>) => {
    const engine = engineRef.current;
    if (!engine) return;
    e.currentTarget.setPointerCapture(e.pointerId);
    engine.strokeStart(getCanvasPoint(e));
  }, []);

  const onPointerMove = useCallback((e: ReactPointerEvent<HTMLCanvasElement>) => {
    const engine = engineRef.current;
    if (!engine) return;
    engine.strokeMove(getCanvasPoint(e));
  }, []);

  const onPointerUp = useCallback((e: ReactPointerEvent<HTMLCanvasElement>) => {
    engineRef.current?.strokeEnd();
    if (e.currentTarget.hasPointerCapture(e.pointerId)) {
      e.currentTarget.releasePointerCapture(e.pointerId);
    }
  }, []);

  const onPointerCancel = useCallback(() => {
    engineRef.current?.strokeCancel();
  }, []);

  // 저장
  const onSave = useCallback(async () => {
    const engine = engineRef.current;
    if (!engine || saveState === 'saving') return;
    setSaveState('saving');
    try {
      const blob = await engine.exportComposite();
      const fileName = `${crypto.randomUUID()}.png`;
      await uploadBlob('artworks', fileName, blob);
      await insertArtwork(page.id, fileName, null);
      navigate('/gallery');
    } catch (err) {
      console.error('save failed:', err);
      setSaveState('error');
    }
  }, [navigate, page.id, saveState]);

  return (
    <>
      <Header
        canUndo={engineState.canUndo}
        canRedo={engineState.canRedo}
        canSave={engineState.isDirty && saveState !== 'saving'}
        saving={saveState === 'saving'}
        onUndo={() => engineRef.current?.undo()}
        onRedo={() => engineRef.current?.redo()}
        onSave={onSave}
      />

      <main className="flex-1 grid place-items-center p-4 min-h-0 overflow-hidden">
        <div
          ref={containerRef}
          className="relative aspect-square w-full max-h-full max-w-full bg-white rounded-2xl shadow-sm"
          style={{ height: 'min(100%, 100vw)' }}
        >
          <canvas
            ref={paintCanvasRef}
            className="absolute inset-0 w-full h-full rounded-2xl touch-none"
            onPointerDown={onPointerDown}
            onPointerMove={onPointerMove}
            onPointerUp={onPointerUp}
            onPointerCancel={onPointerCancel}
          />
          <canvas
            ref={outlineCanvasRef}
            className="absolute inset-0 w-full h-full rounded-2xl pointer-events-none"
          />
        </div>
      </main>

      <Footer
        tool={tool}
        onToolChange={setTool}
        color={color}
        onColorChange={setColor}
        brushSize={brushSize}
        onBrushSizeChange={setBrushSize}
      />

      {saveState === 'error' && (
        <ErrorToast onClose={() => setSaveState('idle')} />
      )}
    </>
  );
}

interface HeaderProps {
  canUndo: boolean;
  canRedo: boolean;
  canSave: boolean;
  saving: boolean;
  onUndo: () => void;
  onRedo: () => void;
  onSave: () => void;
}

function Header({ canUndo, canRedo, canSave, saving, onUndo, onRedo, onSave }: HeaderProps) {
  return (
    <header className="h-touch-lg shrink-0 flex items-center px-3 gap-2 border-b border-black/10">
      <Link to="/" className="kid-btn bg-white px-4 inline-flex items-center justify-center" aria-label="홈">
        🏠
      </Link>
      <div className="flex-1" />
      <button
        type="button"
        className="kid-btn bg-white px-4 disabled:opacity-30"
        disabled={!canUndo}
        onClick={onUndo}
        aria-label="되돌리기"
      >
        ↩️
      </button>
      <button
        type="button"
        className="kid-btn bg-white px-4 disabled:opacity-30"
        disabled={!canRedo}
        onClick={onRedo}
        aria-label="다시하기"
      >
        ↪️
      </button>
      <button
        type="button"
        className="kid-btn bg-app-orange text-white px-4 disabled:opacity-30"
        disabled={!canSave}
        onClick={onSave}
        aria-label="저장"
      >
        {saving ? '⏳' : '💾'}
      </button>
    </header>
  );
}

interface FooterProps {
  tool: Tool;
  onToolChange: (t: Tool) => void;
  color: PaintColor;
  onColorChange: (c: PaintColor) => void;
  brushSize: BrushSizeKey;
  onBrushSizeChange: (k: BrushSizeKey) => void;
}

function Footer({
  tool,
  onToolChange,
  color,
  onColorChange,
  brushSize,
  onBrushSizeChange,
}: FooterProps) {
  return (
    <footer className="shrink-0 border-t border-black/10 bg-app-bg">
      <ColorPalette value={color.hex} onChange={onColorChange} />
      <div className="h-touch-lg flex items-center gap-2 px-4">
        <ToolBar value={tool} onChange={onToolChange} />
        <div className="w-2" />
        <BrushSizePicker value={brushSize} onChange={onBrushSizeChange} color={color.hex} />
      </div>
    </footer>
  );
}

function ErrorToast({ onClose }: { onClose: () => void }) {
  return (
    <div className="fixed bottom-44 left-1/2 -translate-x-1/2 z-10 bg-app-danger text-white px-6 py-3 rounded-full shadow-lg flex items-center gap-3">
      <span>😢 저장 못했어요</span>
      <button type="button" onClick={onClose} aria-label="닫기" className="text-xl">
        ✕
      </button>
    </div>
  );
}
