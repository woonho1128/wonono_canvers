import { Link, useNavigate, useParams } from 'react-router-dom';
import { useCallback, useEffect, useRef, useState } from 'react';
import { useAsyncData } from '@/hooks/useAsyncData';
import { AsyncBoundary } from '@/components/AsyncBoundary';
import { ColorPalette } from '@/components/ColorPalette';
import { PAINT_COLORS, type PaintColor } from '@/components/paintColors';
import { BrushSizePicker } from '@/components/BrushSizePicker';
import { DEFAULT_BRUSH } from '@/components/brushSizes';
import { ToolBar } from '@/components/ToolBar';
import { HoldToConfirm } from '@/components/HoldToConfirm';
import { CanvasEngine, type EngineState, type Tool } from '@/canvas/CanvasEngine';
import { MASK_VERSION, canvasToPngBlob, trimImageWhitespace } from '@/canvas/outlineMask';
import { PointerController } from '@/canvas/pointerController';
import { useSettingsStore } from '@/store/settingsStore';
import { getPageById } from '@/supabase/pages';
import { insertArtwork } from '@/supabase/artworks';
import { publicUrl, uploadBlob } from '@/supabase/storage';
import { getCachedPage, putCachedPage } from '@/db/pagesCache';
import { deleteDraft, loadDraft, saveDraft } from '@/db/drafts';
import { play, primeAudio } from '@/audio/soundEffects';
import { createId } from '@/utils/id';
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
  const [brushSize, setBrushSize] = useState<number>(DEFAULT_BRUSH);
  const [engineState, setEngineState] = useState<EngineState>({
    canUndo: false,
    canRedo: false,
    isDirty: false,
  });
  const [saveState, setSaveState] = useState<'idle' | 'saving' | 'error'>('idle');
  const [canvasDims, setCanvasDims] = useState<{ w: number; h: number }>({ w: 0, h: 0 });
  const [outlineAspect, setOutlineAspect] = useState<number | null>(null);

  // 도안 이미지 비율을 미리 알아내서 캔버스 가용공간을 최대로 활용.
  // 캐시 hit 시 trim된 사이즈를 그대로, miss 시엔 원본 로드 후 trim 결과 사이즈 사용.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        // 1) 캐시 — 이미 trim된 blob이 들어 있으므로 그 사이즈가 곧 콘텐츠 사이즈
        const cached = await getCachedPage(page.id).catch(() => undefined);
        if (cached?.maskVersion === MASK_VERSION) {
          const url = URL.createObjectURL(cached.outlineBlob);
          const img = await loadImage(url);
          URL.revokeObjectURL(url);
          if (!cancelled && img.naturalWidth > 0 && img.naturalHeight > 0) {
            setOutlineAspect(img.naturalWidth / img.naturalHeight);
          }
          return;
        }
        // 2) 캐시 없음/구버전 — 원본 받아 trim 시뮬레이션
        const res = await fetch(
          publicUrl('outlines', page.outline_path),
          import.meta.env.DEV ? { cache: 'reload' } : undefined,
        );
        const blob = await res.blob();
        const img = await loadImage(URL.createObjectURL(blob));
        const trimmed = trimImageWhitespace(img);
        if (!cancelled && trimmed.width > 0 && trimmed.height > 0) {
          setOutlineAspect(trimmed.width / trimmed.height);
        }
      } catch {
        /* aspect 못 구해도 fallback(square)으로 동작 */
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [page.id, page.outline_path]);

  useEffect(() => {
    const viewport = viewportRef.current;
    if (!viewport) return;

    const updateSize = () => {
      const rect = viewport.getBoundingClientRect();
      const style = window.getComputedStyle(viewport);
      const horizontalPadding = parseFloat(style.paddingLeft) + parseFloat(style.paddingRight);
      const verticalPadding = parseFloat(style.paddingTop) + parseFloat(style.paddingBottom);
      const availableWidth = Math.max(0, rect.width - horizontalPadding);
      const availableHeight = Math.max(0, rect.height - verticalPadding);

      // outline aspect를 알면 그 비율로 가용공간 최대 사용. 모르면 정사각형 fallback.
      let w: number;
      let h: number;
      if (outlineAspect && outlineAspect > 0) {
        const viewportAspect = availableWidth / availableHeight;
        if (outlineAspect >= viewportAspect) {
          // 도안이 더 넓음 → 가로 꽉 채우고 세로 줄임
          w = availableWidth;
          h = w / outlineAspect;
        } else {
          // 도안이 더 좁음 → 세로 꽉 채우고 가로 줄임
          h = availableHeight;
          w = h * outlineAspect;
        }
      } else {
        const sq = Math.min(availableWidth, availableHeight);
        w = sq;
        h = sq;
      }
      const nextW = Math.floor(w);
      const nextH = Math.floor(h);
      setCanvasDims((cur) =>
        Math.abs(cur.w - nextW) > 1 || Math.abs(cur.h - nextH) > 1
          ? { w: nextW, h: nextH }
          : cur,
      );
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
  }, [outlineAspect]);

  // 엔진 셋업 + 외곽선/마스크/draft 로드 + Pointer 컨트롤러
  useEffect(() => {
    const paintCanvas = paintCanvasRef.current;
    const outlineCanvas = outlineCanvasRef.current;
    if (!paintCanvas || !outlineCanvas || canvasDims.w <= 0 || canvasDims.h <= 0) return;

    const engine = new CanvasEngine({
      paintCanvas,
      outlineCanvas,
      cssWidth: canvasDims.w,
      cssHeight: canvasDims.h,
    });
    engineRef.current = engine;
    engine.setColor(color.hex);
    engine.setBrushSize(brushSize);
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
      const versionMatches = cached?.maskVersion === MASK_VERSION;

      if (cached && sizeMatches && versionMatches) {
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
        // 캐시가 없거나 사이즈/버전이 안 맞으면 원본을 받아 trim 후 마스크 빌드.
        // trim된 결과를 outlineBlob으로 캐시해서 다음 진입 시 재처리 X.
        const res = await fetch(
          publicUrl('outlines', page.outline_path),
          import.meta.env.DEV ? { cache: 'reload' } : undefined,
        );
        const origBlob = await res.blob();
        if (cancelled) return;
        const origUrl = URL.createObjectURL(origBlob);
        const origImg = await loadImage(origUrl);
        URL.revokeObjectURL(origUrl);
        if (cancelled) return;
        // 흰 패딩 잘라낸 trimmed canvas를 진짜 outline 소스로 사용
        const trimmedCanvas = trimImageWhitespace(origImg);
        const trimmedBlob = await canvasToPngBlob(trimmedCanvas);
        outlineUrl = URL.createObjectURL(trimmedBlob);
        const img = await loadImage(outlineUrl);
        if (cancelled) return;
        engine.drawOutline(img);
        const mask = engine.buildAndSetMask(img);
        void putCachedPage({
          pageId: page.id,
          outlineBlob: trimmedBlob,
          maskBytes: mask.bytes.buffer.slice(0) as ArrayBuffer,
          maskVersion: MASK_VERSION,
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
  }, [page.id, canvasDims.w, canvasDims.h]);

  // 도구/색/굵기/입력 모드 동기화
  useEffect(() => {
    engineRef.current?.setTool(tool);
  }, [tool]);
  useEffect(() => {
    engineRef.current?.setColor(color.hex);
  }, [color.hex]);
  useEffect(() => {
    engineRef.current?.setBrushSize(brushSize);
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
    primeAudio();
    engineRef.current?.resetPaint();
    void deleteDraft(page.id).catch(() => {});
    strokeCountRef.current = 0;
    setSaveState('idle');
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
      const fileName = `${createId()}.png`;
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

      <main ref={viewportRef} className="flex-1 grid place-items-center p-2 min-h-0 overflow-hidden">
        <div
          className="relative bg-white rounded-2xl shadow-sm overflow-hidden"
          style={{ width: canvasDims.w, height: canvasDims.h }}
        >
          <canvas
            ref={paintCanvasRef}
            className="absolute inset-0 w-full h-full rounded-2xl touch-none"
          />
          <canvas
            ref={outlineCanvasRef}
            className="absolute inset-0 w-full h-full rounded-2xl pointer-events-none"
            // AI 변환 도안은 흰 배경 + 검은 선이라 그대로 두면 색칠 레이어를 가림.
            // multiply 합성: 흰색은 투명처럼 작동, 검은 선만 위에 올라옴.
            // OpenCV(투명배경) 도안에도 영향 없음 (투명 픽셀은 multiply의 영향을 안 받음).
            style={{ mixBlendMode: 'multiply' }}
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
  brushSize: number;
  onBrushSizeChange: (px: number) => void;
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
