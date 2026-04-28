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
    <div className="min-h-screen bg-cream font-round text-kid-ink flex flex-col">
      <div className="flex-1 max-w-5xl mx-auto w-full px-6 pt-5 pb-10 lg:px-10 lg:pt-7 flex flex-col">
        <header className="flex items-center gap-4">
          <Link
            to="/parent"
            aria-label="어른 메뉴로"
            className="kid-chunky-cream w-tap h-tap grid place-items-center text-2xl shrink-0"
          >
            ←
          </Link>
          <h1 className="font-display font-extrabold text-[28px] lg:text-[34px] leading-tight">
            <span className="text-kid-orange-deep">사진</span>으로 도안 만들기 ✨
          </h1>
        </header>

        {showCvWarmup && (
          <p className="mt-4 text-center text-sm text-kid-ink-soft font-hand">
            ⏳ 처음 켤 때만 약 10초 — 도안 변환 엔진 준비 중...
          </p>
        )}

        <div className="flex-1 flex flex-col">
          <AsyncBoundary state={categoriesState}>
            {(categories) => <Flow step={step} setStep={setStep} categories={categories} />}
          </AsyncBoundary>
        </div>
      </div>
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
    <div className="flex-1 mt-8 lg:mt-10 flex flex-col items-center justify-center gap-6">
      <p className="text-kid-ink-soft text-lg font-hand">
        어떻게 도안을 만들까요?
      </p>

      {/* 가로(landscape, lg+)에선 3열, 세로/모바일은 1열 */}
      <div className="w-full grid grid-cols-1 lg:grid-cols-3 gap-5">
        <ModeCard
          emoji="⚡"
          accent="bg-[#B5EAD7]"
          title="빠른 변환"
          sub="기기에서 바로 처리 · 무료"
          desc="단순 만화·사물에 좋아요"
          onClick={() => onPick('fast')}
        />
        <ModeCard
          emoji="✨"
          accent="bg-[#FFE680]"
          title="고품질 변환"
          sub="AI · 5~20초"
          desc="인물·복잡한 사진도 OK"
          onClick={() => onPick('api')}
          highlighted
        />
        <ModeCard
          emoji="📤"
          accent="bg-[#D4C5F9]"
          title="도안 직접 업로드"
          sub="이미 만들어진 도안"
          desc="흑백 라인아트 권장"
          onClick={() => onPick('upload')}
        />
      </div>
    </div>
  );
}

function ModeCard({
  emoji,
  accent,
  title,
  sub,
  desc,
  onClick,
  highlighted,
}: {
  emoji: string;
  accent: string;
  title: string;
  sub: string;
  desc: string;
  onClick: () => void;
  highlighted?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={clsx(
        'kid-chunky w-full text-left p-5 lg:p-6 flex items-center gap-4 lg:flex-col lg:items-start lg:gap-3 h-full',
        highlighted ? 'kid-chunky-orange' : 'kid-chunky-cream',
      )}
    >
      <div
        className={clsx(
          'shrink-0 w-16 h-16 lg:w-20 lg:h-20 rounded-[22px] grid place-items-center text-3xl lg:text-4xl',
          highlighted ? 'bg-white/25' : accent,
        )}
      >
        {emoji}
      </div>
      <div className="min-w-0 flex-1 lg:w-full">
        <div className="font-display font-extrabold text-xl lg:text-2xl leading-tight">
          {title}
        </div>
        <div
          className={clsx(
            'text-sm font-bold mt-1',
            highlighted ? 'text-white/90' : 'text-kid-ink',
          )}
        >
          {sub}
        </div>
        <div
          className={clsx(
            'text-xs lg:text-sm mt-1 font-hand',
            highlighted ? 'text-white/80' : 'text-kid-ink-soft',
          )}
        >
          {desc}
        </div>
      </div>
      <span className="shrink-0 text-2xl lg:hidden">›</span>
    </button>
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

  const modeLabel: Record<Mode, string> = {
    fast: '⚡ 빠른 변환',
    api: '✨ 고품질 변환',
    upload: '📤 직접 업로드',
  };

  return (
    <div className="flex-1 mt-7 max-w-3xl mx-auto w-full flex flex-col justify-center gap-5">
      <button
        type="button"
        onClick={onBack}
        className="self-start text-sm font-hand text-kid-ink-soft underline underline-offset-4"
      >
        ← 모드 다시 선택
      </button>

      <div className="bg-peach rounded-chunky px-6 py-5">
        <div className="font-display font-extrabold text-kid-orange-deep text-lg">
          {modeLabel[mode]}
        </div>
        <p className="mt-1 font-hand text-kid-ink whitespace-pre-line text-base lg:text-lg leading-snug">
          {helpText[mode]}
        </p>
      </div>

      <div
        className={clsx(
          'grid gap-4',
          mode === 'upload' ? 'grid-cols-1' : 'grid-cols-1 sm:grid-cols-2',
        )}
      >
        <button
          type="button"
          onClick={() => fileInputRef.current?.click()}
          className="kid-chunky-orange w-full px-6 py-6 flex items-center justify-center gap-3 text-2xl"
        >
          <span className="text-3xl">🖼️</span>
          <span>갤러리에서 고르기</span>
        </button>

        {mode !== 'upload' && (
          <button
            type="button"
            onClick={() => cameraInputRef.current?.click()}
            className="kid-chunky-yellow w-full px-6 py-6 flex items-center justify-center gap-3 text-2xl"
          >
            <span className="text-3xl">📷</span>
            <span>카메라로 찍기</span>
          </button>
        )}
      </div>

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
  const label = mode === 'api' ? '✨ AI로 변환' : '✨ 변환하기';
  return (
    <div className="flex-1 mt-7 max-w-3xl mx-auto w-full flex flex-col items-center justify-center gap-5">
      <div className="w-full bg-white rounded-canvas p-3 shadow-chunky-soft">
        <img
          src={photo.src}
          alt="원본 사진"
          className="block w-full max-h-[60vh] object-contain rounded-[22px]"
        />
      </div>
      <p className="font-hand text-kid-ink-soft text-base">
        이 사진으로 도안을 만들까요?
      </p>
      <div className="flex gap-3 w-full max-w-md">
        <button
          type="button"
          onClick={onCancel}
          className="kid-chunky-cream flex-1 py-4 text-base font-bold"
        >
          다른 사진
        </button>
        <button
          type="button"
          onClick={onConvert}
          className="kid-chunky-orange flex-[1.4] py-4 text-lg"
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
    <div className="flex-1 grid place-items-center text-center">
      <div className="text-7xl animate-bounce">🪄</div>
      <p className="mt-6 font-display font-extrabold text-2xl text-kid-orange-deep">
        {message}
      </p>
      <p className="mt-2 font-hand text-kid-ink-soft">{sub}</p>
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
    <div className="flex-1 mt-6 grid grid-cols-1 lg:grid-cols-[minmax(0,1fr)_360px] gap-6 items-start">
      {/* 좌측: 이미지 + 컨트롤 */}
      <div className="flex flex-col items-stretch gap-4 min-w-0">
        <div
          className="relative bg-white rounded-canvas p-3 shadow-chunky-soft mx-auto max-w-full w-full"
          style={{ aspectRatio: photoAspect, maxHeight: '70vh' }}
          onPointerDown={() => !isUpload && setShowOriginal(true)}
          onPointerUp={() => setShowOriginal(false)}
          onPointerLeave={() => setShowOriginal(false)}
        >
          <img
            src={showOriginal && !isUpload ? step.photoObjectUrl : step.outlineUrl}
            alt={showOriginal ? '원본' : '도안'}
            className="w-full h-full object-contain select-none rounded-[22px]"
            draggable={false}
          />
          {!isUpload && (
            <span className="absolute bottom-4 right-4 bg-kid-ink/85 text-white text-xs font-bold px-3 py-1.5 rounded-full font-hand">
              {showOriginal ? '원본' : '결과'} · 꾹 누르면 원본
            </span>
          )}
        </div>

        {showDetailSlider && (
          <div className="bg-peach rounded-chunky px-5 py-4 flex flex-col gap-2">
            <label className="font-display font-bold text-kid-ink text-sm flex items-center justify-between">
              <span>디테일</span>
              <span className="font-hand text-kid-orange-deep text-base">{detail}</span>
            </label>
            <input
              type="range"
              min={20}
              max={180}
              step={10}
              value={detail}
              onChange={(e) => setDetail(parseInt(e.target.value, 10))}
              className="w-full accent-kid-orange"
            />
          </div>
        )}

        {!isUpload && (
          <p className="text-xs font-hand text-kid-ink-soft text-center px-2">
            ⚠️ 사진 종류에 따라 결과가 달라요. 별로면 다른 사진으로 시도해 보세요.
          </p>
        )}

        <div className="flex gap-3 justify-center flex-wrap">
          {!isUpload && (
            <button
              type="button"
              onClick={() => onRetry(detail)}
              className="kid-chunky-cream px-5 py-3 text-base"
            >
              🔄 다시 변환
            </button>
          )}
          <button
            type="button"
            onClick={onCancel}
            className="kid-chunky px-5 py-3 text-base bg-[#FFB4A2] text-white shadow-[0_6px_0_#D88A78]"
          >
            ❌ 다른 사진
          </button>
        </div>
      </div>

      {/* 우측(가로모드) / 하단(세로모드): 저장 폼 */}
      <div className="bg-white rounded-chunky shadow-chunky-soft p-5 flex flex-col gap-3 lg:sticky lg:top-5">
        <label className="font-display font-bold text-kid-ink text-base">
          이름 <span className="font-hand text-kid-ink-faint text-sm">(선택)</span>
        </label>
        <input
          type="text"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="예: 우리집 강아지"
          maxLength={20}
          className="bg-cream border-2 border-peach rounded-2xl px-4 py-3 text-base font-round
                     focus:outline-none focus:border-kid-orange transition-colors"
        />

        <label className="font-display font-bold text-kid-ink text-base mt-2">
          카테고리
        </label>
        <div className="flex gap-2 flex-wrap">
          {usableCategories.map((c) => {
            const active = c.id === categoryId;
            return (
              <button
                key={c.id}
                type="button"
                onClick={() => setCategoryId(active ? null : c.id)}
                className={clsx(
                  'px-4 py-2.5 rounded-full font-display font-bold text-sm transition-all',
                  active
                    ? 'bg-kid-orange text-white shadow-chunky-orange'
                    : 'bg-cream text-kid-ink shadow-chunky',
                )}
              >
                {c.icon_emoji ?? '🎨'} {c.name}
              </button>
            );
          })}
        </div>

        <button
          type="button"
          onClick={() => onSave(title, categoryId)}
          disabled={!categoryId}
          className="kid-chunky-orange w-full py-4 text-lg mt-3
                     disabled:bg-kid-ink-faint disabled:shadow-none disabled:opacity-50
                     disabled:active:translate-y-0"
        >
          💾 도안으로 저장
        </button>
      </div>
    </div>
  );
}

function SavingStep() {
  return (
    <div className="flex-1 grid place-items-center text-center">
      <div className="text-7xl animate-bounce">💾</div>
      <p className="mt-6 font-display font-extrabold text-2xl text-kid-orange-deep">
        저장 중...
      </p>
    </div>
  );
}
