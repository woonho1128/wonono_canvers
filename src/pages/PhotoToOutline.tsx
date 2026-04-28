import { Link } from 'react-router-dom';
import { useEffect, useRef, useState } from 'react';
import clsx from 'clsx';
import { useAsyncData } from '@/hooks/useAsyncData';
import { AsyncBoundary } from '@/components/AsyncBoundary';
import {
  convertPhotoToOutline,
  fileToImage,
  isConverterReady,
  onConverterReady,
  warmupConverter,
} from '@/cv/photoConverter';
import { convertPhotoToOutlineApi } from '@/cv/apiConverter';
import { listCategories } from '@/supabase/categories';
import { insertUserPage } from '@/supabase/pages';
import { uploadBlob } from '@/supabase/storage';
import { createId } from '@/utils/id';
import type { Category } from '@/supabase/types';

type Mode = 'fast' | 'api' | 'upload';

type Step =
  | { kind: 'mode' }
  | { kind: 'pick'; mode: Mode }
  | { kind: 'preview'; mode: Mode; photo: HTMLImageElement; objectUrl: string }
  | { kind: 'converting'; mode: Mode; photo: HTMLImageElement; objectUrl: string }
  | {
      kind: 'result';
      mode: Mode;
      photo: HTMLImageElement;
      photoObjectUrl: string;
      outline: Blob;
      outlineUrl: string;
      detail: number;
    }
  | { kind: 'saving' };

export default function PhotoToOutline() {
  const [step, setStep] = useState<Step>({ kind: 'mode' });
  const [cvReady, setCvReady] = useState(isConverterReady());
  const categoriesState = useAsyncData(listCategories, []);

  // OpenCV 워커는 'fast' 모드에서만 필요. mode 진입 후 fast 선택할 때 띄움.
  useEffect(() => {
    if (
      (step.kind === 'pick' || step.kind === 'preview' || step.kind === 'converting') &&
      step.mode === 'fast'
    ) {
      warmupConverter();
      const off = onConverterReady(() => setCvReady(true));
      return off;
    }
    return undefined;
  }, [step]);

  const showCvWarmup = step.kind === 'pick' && step.mode === 'fast' && !cvReady;

  return (
    <div className="min-h-full p-6 bg-app-bg">
      <Link to="/parent" className="kid-btn bg-white px-6 inline-flex items-center">
        ⬅️ 어른 메뉴
      </Link>
      <h1 className="text-kid-title mt-6 text-center">사진으로 도안 만들기</h1>

      {showCvWarmup && (
        <p className="text-center text-sm text-app-text/50 mt-4">
          ⏳ 처음 켤 때만 약 10초 — 도안 변환 엔진 준비 중...
        </p>
      )}

      <AsyncBoundary state={categoriesState}>
        {(categories) => <Flow step={step} setStep={setStep} categories={categories} />}
      </AsyncBoundary>
    </div>
  );
}

function Flow({
  step,
  setStep,
  categories,
}: {
  step: Step;
  setStep: (s: Step) => void;
  categories: Category[];
}) {
  switch (step.kind) {
    case 'mode':
      return <ModeStep onPick={(mode) => setStep({ kind: 'pick', mode })} />;
    case 'pick':
      return (
        <PickStep
          mode={step.mode}
          onBack={() => setStep({ kind: 'mode' })}
          onPicked={(file) => onFilePicked(file, step.mode, setStep)}
        />
      );
    case 'preview':
      return (
        <PreviewStep
          mode={step.mode}
          photo={step.photo}
          onConvert={() => convert(step, setStep, 100)}
          onCancel={() => {
            URL.revokeObjectURL(step.objectUrl);
            setStep({ kind: 'pick', mode: step.mode });
          }}
        />
      );
    case 'converting':
      return <ConvertingStep mode={step.mode} />;
    case 'result':
      return (
        <ResultStep
          step={step}
          categories={categories}
          onRetry={(detail) => convert(step, setStep, detail)}
          onCancel={() => {
            URL.revokeObjectURL(step.photoObjectUrl);
            URL.revokeObjectURL(step.outlineUrl);
            setStep({ kind: 'pick', mode: step.mode });
          }}
          onSave={(title, categoryId) => save(step, title, categoryId, setStep)}
        />
      );
    case 'saving':
      return <SavingStep />;
  }
}

async function onFilePicked(
  file: File,
  mode: Mode,
  setStep: (s: Step) => void,
): Promise<void> {
  const photo = await fileToImage(file);

  // upload 모드는 변환 없이 바로 결과 화면으로
  if (mode === 'upload') {
    const blob = await fileToBlob(file);
    const outlineUrl = URL.createObjectURL(blob);
    setStep({
      kind: 'result',
      mode,
      photo,
      photoObjectUrl: photo.src,
      outline: blob,
      outlineUrl,
      detail: 100,
    });
    return;
  }

  setStep({ kind: 'preview', mode, photo, objectUrl: photo.src });
}

async function fileToBlob(file: File): Promise<Blob> {
  // PNG가 아니면 Canvas로 PNG 변환 (도안은 PNG로 통일)
  if (file.type === 'image/png') return file;
  const bitmap = await createImageBitmap(file);
  const canvas = document.createElement('canvas');
  canvas.width = bitmap.width;
  canvas.height = bitmap.height;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Canvas 컨텍스트 생성 실패');
  ctx.drawImage(bitmap, 0, 0);
  return new Promise<Blob>((resolve, reject) => {
    canvas.toBlob(
      (b) => (b ? resolve(b) : reject(new Error('PNG 변환 실패'))),
      'image/png',
    );
  });
}

async function convert(
  step: {
    mode: Mode;
    photo: HTMLImageElement;
    objectUrl?: string;
    photoObjectUrl?: string;
    outlineUrl?: string;
  },
  setStep: (s: Step) => void,
  detail: number,
): Promise<void> {
  const { mode, photo } = step;
  const photoObjectUrl = step.photoObjectUrl ?? step.objectUrl ?? '';
  const oldOutlineUrl = step.outlineUrl;
  setStep({ kind: 'converting', mode, photo, objectUrl: photoObjectUrl });

  try {
    let blob: Blob;
    if (mode === 'api') {
      blob = await convertPhotoToOutlineApi(photo);
    } else {
      blob = await convertPhotoToOutline(photo, detail);
    }
    const outlineUrl = URL.createObjectURL(blob);
    if (oldOutlineUrl) URL.revokeObjectURL(oldOutlineUrl);
    setStep({
      kind: 'result',
      mode,
      photo,
      photoObjectUrl,
      outline: blob,
      outlineUrl,
      detail,
    });
  } catch (err) {
    console.error('conversion failed:', err);
    alert(`변환 실패: ${err instanceof Error ? err.message : String(err)}`);
    setStep({ kind: 'preview', mode, photo, objectUrl: photoObjectUrl });
  }
}

async function save(
  step: { photo: HTMLImageElement; photoObjectUrl: string; outline: Blob; outlineUrl: string },
  title: string,
  categoryId: string | null,
  setStep: (s: Step) => void,
): Promise<void> {
  setStep({ kind: 'saving' });
  try {
    const fileName = `user/${createId()}.png`;
    await uploadBlob('outlines', fileName, step.outline);
    await insertUserPage(fileName, null, title || null, categoryId);
    URL.revokeObjectURL(step.photoObjectUrl);
    URL.revokeObjectURL(step.outlineUrl);
    window.location.href = categoryId ? `/categories/${categoryId}` : '/categories';
  } catch (err) {
    console.error('save failed:', err);
    alert(`저장 실패: ${err instanceof Error ? err.message : String(err)}`);
    setStep({
      kind: 'result',
      mode: 'fast',
      photo: step.photo,
      photoObjectUrl: step.photoObjectUrl,
      outline: step.outline,
      outlineUrl: step.outlineUrl,
      detail: 100,
    });
  }
}

// ============== Steps ==============

function ModeStep({ onPick }: { onPick: (mode: Mode) => void }) {
  return (
    <div className="mt-8 max-w-md mx-auto flex flex-col gap-4">
      <p className="text-kid-body text-center text-app-text/70">
        어떻게 도안을 만들까요?
      </p>

      <button
        type="button"
        onClick={() => onPick('fast')}
        className="kid-btn bg-app-mint text-white py-5 text-left px-6"
      >
        <div className="text-2xl font-bold">⚡ 빠른 변환 (무료)</div>
        <div className="text-sm opacity-90 mt-1">
          기기에서 바로 처리 · 단순 만화/사물에 좋음
        </div>
      </button>

      <button
        type="button"
        onClick={() => onPick('api')}
        className="kid-btn bg-app-orange text-white py-5 text-left px-6"
      >
        <div className="text-2xl font-bold">✨ 고품질 변환 (AI)</div>
        <div className="text-sm opacity-90 mt-1">
          AI가 깔끔한 도안으로 · 5~20초 · 인물·복잡한 사진도 OK
        </div>
      </button>

      <button
        type="button"
        onClick={() => onPick('upload')}
        className="kid-btn bg-white py-5 text-left px-6 ring-2 ring-black/10"
      >
        <div className="text-2xl font-bold">📤 도안 직접 업로드</div>
        <div className="text-sm text-app-text/70 mt-1">
          이미 만들어진 도안 이미지를 그대로 등록
        </div>
      </button>
    </div>
  );
}

function PickStep({
  mode,
  onBack,
  onPicked,
}: {
  mode: Mode;
  onBack: () => void;
  onPicked: (file: File) => void;
}) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);

  const helpText: Record<Mode, string> = {
    fast: '도안으로 만들고 싶은 사진을 골라주세요.\n단순한 만화·사물이 잘 변환됩니다.',
    api: '도안으로 만들고 싶은 사진을 골라주세요.\nAI가 깔끔한 도안을 만들어줍니다.',
    upload: '이미 만들어진 도안 이미지를 골라주세요.\n흑백 라인아트 권장.',
  };

  return (
    <div className="mt-8 max-w-md mx-auto flex flex-col gap-4">
      <button
        type="button"
        onClick={onBack}
        className="self-start text-sm text-app-text/60 underline"
      >
        ← 모드 다시 선택
      </button>
      <p className="text-kid-body text-center text-app-text/70 whitespace-pre-line">
        {helpText[mode]}
      </p>
      <button
        type="button"
        onClick={() => fileInputRef.current?.click()}
        className="kid-btn bg-app-orange text-white py-6 text-2xl"
      >
        🖼️ 갤러리에서 고르기
      </button>
      {mode !== 'upload' && (
        <button
          type="button"
          onClick={() => cameraInputRef.current?.click()}
          className="kid-btn bg-app-mint text-white py-6 text-2xl"
        >
          📷 카메라로 찍기
        </button>
      )}
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) onPicked(f);
          e.target.value = '';
        }}
      />
      <input
        ref={cameraInputRef}
        type="file"
        accept="image/*"
        capture="environment"
        className="hidden"
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) onPicked(f);
          e.target.value = '';
        }}
      />
    </div>
  );
}

function PreviewStep({
  mode,
  photo,
  onConvert,
  onCancel,
}: {
  mode: Mode;
  photo: HTMLImageElement;
  onConvert: () => void;
  onCancel: () => void;
}) {
  const label = mode === 'api' ? '✨ AI로 변환하기' : '✨ 변환하기';
  return (
    <div className="mt-8 max-w-2xl mx-auto flex flex-col items-center gap-4">
      <img
        src={photo.src}
        alt="원본 사진"
        className="max-h-[60vh] max-w-full rounded-2xl shadow"
      />
      <div className="flex gap-4 mt-4">
        <button type="button" onClick={onCancel} className="kid-btn bg-white px-6 py-3">
          다른 사진
        </button>
        <button
          type="button"
          onClick={onConvert}
          className="kid-btn bg-app-orange text-white px-8 py-3"
        >
          {label}
        </button>
      </div>
    </div>
  );
}

function ConvertingStep({ mode }: { mode: Mode }) {
  const message =
    mode === 'api' ? 'AI가 도안을 만들고 있어요...' : '도안으로 만들고 있어요...';
  const sub = mode === 'api' ? '5~20초 정도 걸려요' : '처음엔 좀 오래 걸려요 (~10초)';
  return (
    <div className="mt-16 grid place-items-center text-center">
      <div className="text-7xl animate-pulse">🪄</div>
      <p className="text-kid-body mt-6">{message}</p>
      <p className="text-sm text-app-text/60 mt-2">{sub}</p>
    </div>
  );
}

function ResultStep({
  step,
  categories,
  onRetry,
  onCancel,
  onSave,
}: {
  step: {
    mode: Mode;
    photo: HTMLImageElement;
    photoObjectUrl: string;
    outlineUrl: string;
    detail: number;
  };
  categories: Category[];
  onRetry: (detail: number) => void;
  onCancel: () => void;
  onSave: (title: string, categoryId: string | null) => void;
}) {
  const [showOriginal, setShowOriginal] = useState(false);
  const [detail, setDetail] = useState(step.detail);
  const [title, setTitle] = useState('');
  const [categoryId, setCategoryId] = useState<string | null>(null);

  const photoAspect =
    step.photo.naturalWidth && step.photo.naturalHeight
      ? step.photo.naturalWidth / step.photo.naturalHeight
      : 1;

  const usableCategories = categories.filter((c) => c.name !== '내 도안').concat(
    categories.filter((c) => c.name === '내 도안'),
  );

  const isUpload = step.mode === 'upload';
  const showDetailSlider = step.mode === 'fast';

  return (
    <div className="mt-6 max-w-2xl mx-auto flex flex-col items-center gap-4">
      <div
        className="relative bg-white rounded-2xl shadow overflow-hidden grid place-items-center max-h-[65vh] max-w-full"
        style={{ aspectRatio: photoAspect }}
        onPointerDown={() => !isUpload && setShowOriginal(true)}
        onPointerUp={() => setShowOriginal(false)}
        onPointerLeave={() => setShowOriginal(false)}
      >
        <img
          src={showOriginal && !isUpload ? step.photoObjectUrl : step.outlineUrl}
          alt={showOriginal ? '원본' : '도안'}
          className="w-full h-full object-contain select-none"
          draggable={false}
        />
        {!isUpload && (
          <span className="absolute bottom-2 right-2 bg-black/60 text-white text-xs px-2 py-1 rounded-full">
            {showOriginal ? '원본' : '결과'} (꾹 누르면 원본 보기)
          </span>
        )}
      </div>

      {showDetailSlider && (
        <div className="w-full flex flex-col gap-1">
          <label className="text-sm text-app-text/70">디테일 (현재: {detail})</label>
          <input
            type="range"
            min={20}
            max={180}
            step={10}
            value={detail}
            onChange={(e) => setDetail(parseInt(e.target.value, 10))}
            className="w-full"
          />
        </div>
      )}

      {!isUpload && (
        <p className="text-sm text-app-text/60 text-center px-4">
          ⚠️ 사진 종류에 따라 결과가 다릅니다. 별로면 다른 사진으로 시도해 보세요.
        </p>
      )}

      <div className="flex gap-2 flex-wrap justify-center">
        {!isUpload && (
          <button
            type="button"
            onClick={() => onRetry(detail)}
            className="kid-btn bg-white px-5 py-2"
          >
            🔄 다시 변환
          </button>
        )}
        <button
          type="button"
          onClick={onCancel}
          className="kid-btn bg-app-danger text-white px-5 py-2"
        >
          ❌ 다른 사진
        </button>
      </div>

      <div className="w-full mt-6 bg-white p-4 rounded-2xl flex flex-col gap-3">
        <label className="text-sm font-bold">이름 (선택)</label>
        <input
          type="text"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="예: 우리집 강아지"
          maxLength={20}
          className="border-2 border-black/10 rounded-xl px-4 py-2 text-base"
        />
        <label className="text-sm font-bold mt-2">카테고리</label>
        <div className="flex gap-2 flex-wrap">
          {usableCategories.map((c) => (
            <button
              key={c.id}
              type="button"
              onClick={() => setCategoryId(c.id === categoryId ? null : c.id)}
              className={clsx(
                'px-3 py-2 rounded-full text-sm font-bold transition',
                c.id === categoryId
                  ? 'bg-app-orange text-white'
                  : 'bg-app-bg ring-2 ring-black/10',
              )}
            >
              {c.icon_emoji ?? '🎨'} {c.name}
            </button>
          ))}
        </div>
        <button
          type="button"
          onClick={() => onSave(title, categoryId)}
          disabled={!categoryId}
          className="kid-btn bg-app-orange text-white py-3 mt-2 disabled:opacity-30"
        >
          💾 도안으로 저장
        </button>
      </div>
    </div>
  );
}

function SavingStep() {
  return (
    <div className="mt-16 grid place-items-center text-center">
      <div className="text-7xl animate-pulse">💾</div>
      <p className="text-kid-body mt-6">저장 중...</p>
    </div>
  );
}
