import { Link, useNavigate, useParams } from 'react-router-dom';
import { useCallback, useEffect, useRef, useState } from 'react';
import { useAsyncData } from '@/hooks/useAsyncData';
import { AsyncBoundary } from '@/components/AsyncBoundary';
import { ColorPalette } from '@/components/ColorPalette';
import { PAINT_COLORS, type PaintColor } from '@/components/paintColors';
import { BrushSizePicker } from '@/components/BrushSizePicker';
import { BRUSH_SIZES, type BrushSizeKey } from '@/components/brushSizes';
import { ToolBar } from '@/components/ToolBar';
import { HoldToConfirm } from '@/components/HoldToConfirm';
import { CanvasEngine, type EngineState, type Tool } from '@/canvas/CanvasEngine';
import { PointerController } from '@/canvas/pointerController';
import { useSettingsStore } from '@/store/settingsStore';
import { getPageById } from '@/supabase/pages';
import { insertArtwork } from '@/supabase/artworks';
import { publicUrl, uploadBlob } from '@/supabase/storage';
import { getCachedPage, putCachedPage } from '@/db/pagesCache';
import { deleteDraft, loadDraft, saveDraft } from '@/db/drafts';
import { play, primeAudio } from '@/audio/soundEffects';
import type { ColoringPage } from '@/supabase/types';

const AUTOSAVE_DEBOUNCE_MS = 500;

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
  const viewportRef = useRef<HTMLElement>(null);
  const paintCanvasRef = useRef<HTMLCanvasElement>(null);
  const outlineCanvasRef = useRef<HTMLCanvasElement>(null);
  const engineRef = useRef<CanvasEngine | null>(null);
  const pointerRef = useRef<PointerController | null>(null);
  const strokeCountRef = useRef(0);

  const inputMode = useSettingsStore((s) => s.inputMode);

  const [tool, setTool] = useState<Tool>('brush');
  const [color, setColor] = useState<PaintColor>(PAINT_COLORS[0]);
  const [brushSize, setBrushSize] = useState<BrushSizeKey>('medium');
  const [engineState, setEngineState] = useState<EngineState>({
    canUndo: false,
    canRedo: false,
    isDirty: false,
  });
  const [saveState, setSaveState] = useState<'idle' | 'saving' | 'error'>('idle');
  const [canvasSize, setCanvasSize] = useState(0);

  useEffect(() => {
    const viewport = viewportRef.current;
    if (!viewport) return;

    const updateSize = () => {
      const rect = viewport.getBoundingClientRect();
      const style = window.getComputedStyle(viewport);
      const horizontalPadding = parseFloat(style.paddingLeft) + parseFloat(style.paddingRight);
      const verticalPadding = parseFloat(style.paddingTop) + parseFloat(style.paddingBottom);
      const availableWidth = rect.width - horizontalPadding;
      const availableHeight = rect.height - verticalPadding;
      const nextSize = Math.floor(Math.min(availableWidth, availableHeight));
      setCanvasSize((current) => (Math.abs(current - nextSize) > 1 ? nextSize : current));
    };

    updateSize();
    const observer = new ResizeObserver(updateSize);
    observer.observe(viewport);
    window.addEventListener('orientationchange', updateSize);
    window.addEventListener('resize', updateSize);

    return () => {
      observer.disconnect();
      window.removeEventListener('orientationchange', updateSize);
      window.removeEventListener('resize', updateSize);
    };
  }, []);

  // 엔진 셋업 + 외곽선/마스크/draft 로드 + Pointer 컨트롤러
  useEffect(() => {
    const paintCanvas = paintCanvasRef.current;
    const outlineCanvas = outlineCanvasRef.current;
    if (!paintCanvas || !outlineCanvas || canvasSize <= 0) return;

    const engine = new CanvasEngine({
      paintCanvas,
      outlineCanvas,
      cssWidth: canvasSize,
      cssHeight: canvasSize,
    });
    engineRef.current = engine;
    engine.setColor(color.hex);
    engine.setBrushSize(BRUSH_SIZES[brushSize]);
    engine.setTool(tool);

    const unsubscribe = engine.subscribe(setEngineState);

    const controller = new PointerController(paintCanvas, {
      onStrokeStart: (p) => engine.strokeStart(p),
      onStrokeMove: (p) => engine.strokeMove(p),
      onStrokeEnd: () => engine.strokeEnd(),
      onStrokeCancel: () => engine.strokeCancel(),
    });
    controller.setMode(inputMode);
    pointerRef.current = controller;

    let cancelled = false;
    let outlineUrl: string | null = null;

    const init = async () => {
      // 1) 외곽선 + 마스크 로드 (캐시 우선)
      const cached = await getCachedPage(page.id).catch(() => undefined);
      const sizeMatches =
        cached && cached.width === engine.internalWidth && cached.height === engine.internalHeight;

      if (cached && sizeMatches) {
        outlineUrl = URL.createObjectURL(cached.outlineBlob);
        const img = await loadImage(outlineUrl);
        if (cancelled) return;
        engine.drawOutline(img);
        engine.setOutlineMask({
          bytes: new Uint8Array(cached.maskBytes),
          width: cached.width,
          height: cached.height,
        });
      } else {
        const res = await fetch(
          publicUrl('outlines', page.outline_path),
          import.meta.env.DEV ? { cache: 'reload' } : undefined,
        );
        const blob = await res.blob();
        if (cancelled) return;
        outlineUrl = URL.createObjectURL(blob);
        const img = await loadImage(outlineUrl);
        if (cancelled) return;
        engine.drawOutline(img);
        const mask = engine.buildAndSetMask(img);
        void putCachedPage({
          pageId: page.id,
          outlineBlob: blob,
          maskBytes: mask.bytes.buffer.slice(0) as ArrayBuffer,
          width: mask.width,
          height: mask.height,
          cachedAt: Date.now(),
        }).catch((err) => console.warn('mask cache failed:', err));
      }

      // 2) 미완성 draft 있으면 복원
      const draft = await loadDraft(page.id).catch(() => undefined);
      if (draft && !cancelled) {
        await engine.loadPaintBlob(draft.canvasBlob);
        strokeCountRef.current = draft.strokeCount;
      }
    };

    void init().catch((err) => console.error('init failed:', err));

    return () => {
      cancelled = true;
      if (outlineUrl) URL.revokeObjectURL(outlineUrl);
      controller.destroy();
      unsubscribe();
      engineRef.current = null;
      pointerRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page.id, canvasSize]);

  // 도구/색/굵기/입력 모드 동기화
  useEffect(() => {
    engineRef.current?.setTool(tool);
  }, [tool]);
  useEffect(() => {
    engineRef.current?.setColor(color.hex);
  }, [color.hex]);
  useEffect(() => {
    engineRef.current?.setBrushSize(BRUSH_SIZES[brushSize]);
  }, [brushSize]);
  useEffect(() => {
    pointerRef.current?.setMode(inputMode);
  }, [inputMode]);

  // 자동저장: stroke마다 debounce 500ms로 paint blob → IndexedDB
  useEffect(() => {
    if (!engineState.isDirty) return;
    strokeCountRef.current += 1;
    const timer = setTimeout(() => {
      const engine = engineRef.current;
      if (!engine) return;
      void engine
        .exportPaintBlob()
        .then((blob) =>
          saveDraft({
            pageId: page.id,
            canvasBlob: blob,
            savedAt: Date.now(),
            strokeCount: strokeCountRef.current,
          }),
        )
        .catch((err) => console.warn('autosave failed:', err));
    }, AUTOSAVE_DEBOUNCE_MS);
    return () => clearTimeout(timer);
  }, [engineState, page.id]);

  // 색 선택 효과음
  const handleColorChange = useCallback((c: PaintColor) => {
    primeAudio();
    setColor(c);
    play('pickColor');
  }, []);

  const handleToolChange = useCallback((t: Tool) => {
    primeAudio();
    setTool(t);
    play('pickColor');
  }, []);

  // Undo / Redo
  const onUndo = useCallback(() => {
    primeAudio();
    if (engineRef.current?.undo()) play('undo');
  }, []);
  const onRedo = useCallback(() => {
    primeAudio();
    if (engineRef.current?.redo()) play('undo');
  }, []);

  // 처음부터 다시
  const onReset = useCallback(() => {
    engineRef.current?.resetPaint();
    void deleteDraft(page.id).catch(() => {});
    strokeCountRef.current = 0;
    play('reset');
  }, [page.id]);

  // 저장
  const onSave = useCallback(async () => {
    primeAudio();
    const engine = engineRef.current;
    if (!engine || saveState === 'saving') return;
    setSaveState('saving');
    try {
      const blob = await engine.exportComposite();
      const fileName = `${crypto.randomUUID()}.png`;
      await uploadBlob('artworks', fileName, blob);
      await insertArtwork(page.id, fileName, null);
      await deleteDraft(page.id).catch(() => {});
      play('save');
      navigate('/gallery');
    } catch (err) {
      console.error('save failed:', err);
      setSaveState('error');
    }
  }, [navigate, page.id, saveState]);

  // fill 도구 효과음 — engineState.isDirty 변화로는 fill인지 brush인지 모름.
  // CanvasEngine 호출 자체에 효과음 hook을 끼우는 게 정석이지만 V3b 단순화:
  // tool === 'fill'일 때 캔버스에 pointerdown 발생하면 fill 사운드.
  useEffect(() => {
    const canvas = paintCanvasRef.current;
    if (!canvas) return;
    const handler = () => {
      primeAudio();
      if (tool === 'fill') play('fill');
    };
    canvas.addEventListener('pointerdown', handler);
    return () => canvas.removeEventListener('pointerdown', handler);
  }, [tool]);

  return (
    <>
      <Header
        canUndo={engineState.canUndo}
        canRedo={engineState.canRedo}
        canSave={engineState.isDirty && saveState !== 'saving'}
        canReset={engineState.isDirty}
        saving={saveState === 'saving'}
        onUndo={onUndo}
        onRedo={onRedo}
        onSave={onSave}
        onReset={onReset}
      />

      <main ref={viewportRef} className="flex-1 grid place-items-center p-4 min-h-0 overflow-hidden">
        <div
          className="relative bg-white rounded-2xl shadow-sm overflow-hidden"
          style={{ width: canvasSize, height: canvasSize }}
        >
          <canvas
            ref={paintCanvasRef}
            className="absolute inset-0 w-full h-full rounded-2xl touch-none"
          />
          <canvas
            ref={outlineCanvasRef}
            className="absolute inset-0 w-full h-full rounded-2xl pointer-events-none"
          />
        </div>
      </main>

      <Footer
        tool={tool}
        onToolChange={handleToolChange}
        color={color}
        onColorChange={handleColorChange}
        brushSize={brushSize}
        onBrushSizeChange={setBrushSize}
      />

      {saveState === 'error' && <ErrorToast onClose={() => setSaveState('idle')} />}
    </>
  );
}

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error('image load failed'));
    img.src = src;
  });
}

interface HeaderProps {
  canUndo: boolean;
  canRedo: boolean;
  canSave: boolean;
  canReset: boolean;
  saving: boolean;
  onUndo: () => void;
  onRedo: () => void;
  onSave: () => void;
  onReset: () => void;
}

function Header({
  canUndo,
  canRedo,
  canSave,
  canReset,
  saving,
  onUndo,
  onRedo,
  onSave,
  onReset,
}: HeaderProps) {
  return (
    <header className="h-touch-lg shrink-0 flex items-center px-2 gap-1 border-b border-black/10">
      <Link
        to="/"
        className="kid-btn bg-white px-4 inline-flex items-center justify-center"
        aria-label="홈"
      >
        🏠
      </Link>
      <HoldToConfirm
        label="처음부터 다시 (길게 누르세요)"
        onConfirm={onReset}
        disabled={!canReset}
      >
        🗑️
      </HoldToConfirm>
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
      <div className="h-touch-lg flex items-center gap-2 px-4 overflow-x-auto">
        <ToolBar value={tool} onChange={onToolChange} />
        <div className="w-2 shrink-0" />
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
