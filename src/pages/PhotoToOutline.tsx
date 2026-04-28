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
import { listCategories } from '@/supabase/categories';
import { insertUserPage } from '@/supabase/pages';
import { uploadBlob } from '@/supabase/storage';
import { createId } from '@/utils/id';
import type { Category } from '@/supabase/types';

type Step =
  | { kind: 'pick' }
  | { kind: 'preview'; photo: HTMLImageElement; objectUrl: string }
  | { kind: 'converting'; photo: HTMLImageElement; objectUrl: string }
  | {
      kind: 'result';
      photo: HTMLImageElement;
      photoObjectUrl: string;
      outline: Blob;
      outlineUrl: string;
      detail: number;
    }
  | { kind: 'saving' };

export default function PhotoToOutline() {
  const [step, setStep] = useState<Step>({ kind: 'pick' });
  const [cvReady, setCvReady] = useState(isConverterReady());
  const categoriesState = useAsyncData(listCategories, []);

  // 페이지 진입 시 워커 spawn → OpenCV.js 백그라운드 로드 시작
  useEffect(() => {
    warmupConverter();
    return onConverterReady(() => setCvReady(true));
  }, []);

  return (
    <div className="min-h-full p-6 bg-app-bg">
      <Link to="/parent" className="kid-btn bg-white px-6 inline-flex items-center">
        ⬅️ 어른 메뉴
      </Link>
      <h1 className="text-kid-title mt-6 text-center">사진으로 도안 만들기</h1>

      {!cvReady && step.kind === 'pick' && (
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
    case 'pick':
      return <PickStep onPicked={(file) => onFilePicked(file, setStep)} />;
    case 'preview':
      return (
        <PreviewStep
          photo={step.photo}
          onConvert={() => convert(step, setStep, 100)}
          onCancel={() => {
            URL.revokeObjectURL(step.objectUrl);
            setStep({ kind: 'pick' });
          }}
        />
      );
    case 'converting':
      return <ConvertingStep />;
    case 'result':
      return (
        <ResultStep
          step={step}
          categories={categories}
          onRetry={(detail) => convert(step, setStep, detail)}
          onCancel={() => {
            URL.revokeObjectURL(step.photoObjectUrl);
            URL.revokeObjectURL(step.outlineUrl);
            setStep({ kind: 'pick' });
          }}
          onSave={(title, categoryId) => save(step, title, categoryId, setStep)}
        />
      );
    case 'saving':
      return <SavingStep />;
  }
}

async function onFilePicked(file: File, setStep: (s: Step) => void): Promise<void> {
  const photo = await fileToImage(file);
  setStep({ kind: 'preview', photo, objectUrl: photo.src });
}

async function convert(
  step: { photo: HTMLImageElement; objectUrl?: string; photoObjectUrl?: string; outlineUrl?: string },
  setStep: (s: Step) => void,
  detail: number,
): Promise<void> {
  const photo = step.photo;
  const photoObjectUrl = step.photoObjectUrl ?? step.objectUrl ?? '';
  const oldOutlineUrl = step.outlineUrl;
  setStep({ kind: 'converting', photo, objectUrl: photoObjectUrl });

  try {
    const blob = await convertPhotoToOutline(photo, detail);
    const outlineUrl = URL.createObjectURL(blob);
    if (oldOutlineUrl) URL.revokeObjectURL(oldOutlineUrl);
    setStep({
      kind: 'result',
      photo,
      photoObjectUrl,
      outline: blob,
      outlineUrl,
      detail,
    });
  } catch (err) {
    console.error('conversion failed:', err);
    alert(`변환 실패: ${err instanceof Error ? err.message : String(err)}`);
    setStep({ kind: 'preview', photo, objectUrl: photoObjectUrl });
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
    // 카테고리로 이동 (categoryId가 있으면 거기로, 없으면 카테고리 선택 화면)
    window.location.href = categoryId ? `/categories/${categoryId}` : '/categories';
  } catch (err) {
    console.error('save failed:', err);
    alert(`저장 실패: ${err instanceof Error ? err.message : String(err)}`);
    setStep({
      kind: 'result',
      photo: step.photo,
      photoObjectUrl: step.photoObjectUrl,
      outline: step.outline,
      outlineUrl: step.outlineUrl,
      detail: 100,
    });
  }
}

// ============== Steps ==============

function PickStep({ onPicked }: { onPicked: (file: File) => void }) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);

  return (
    <div className="mt-12 max-w-md mx-auto flex flex-col gap-4">
      <p className="text-kid-body text-center text-app-text/70">
        도안으로 만들고 싶은 사진을 골라주세요.
        <br />
        단순한 만화·사물이 잘 변환됩니다.
      </p>
      <button
        type="button"
        onClick={() => fileInputRef.current?.click()}
        className="kid-btn bg-app-orange text-white py-6 text-2xl"
      >
        🖼️ 갤러리에서 고르기
      </button>
      <button
        type="button"
        onClick={() => cameraInputRef.current?.click()}
        className="kid-btn bg-app-mint text-white py-6 text-2xl"
      >
        📷 카메라로 찍기
      </button>
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) onPicked(f);
          e.target.value = ''; // 같은 파일 재선택 가능하게
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
  photo,
  onConvert,
  onCancel,
}: {
  photo: HTMLImageElement;
  onConvert: () => void;
  onCancel: () => void;
}) {
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
          ✨ 변환하기
        </button>
      </div>
    </div>
  );
}

function ConvertingStep() {
  return (
    <div className="mt-16 grid place-items-center text-center">
      <div className="text-7xl animate-pulse">🪄</div>
      <p className="text-kid-body mt-6">도안으로 만들고 있어요...</p>
      <p className="text-sm text-app-text/60 mt-2">처음엔 좀 오래 걸려요 (~10초)</p>
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
  step: { photo: HTMLImageElement; photoObjectUrl: string; outlineUrl: string; detail: number };
  categories: Category[];
  onRetry: (detail: number) => void;
  onCancel: () => void;
  onSave: (title: string, categoryId: string | null) => void;
}) {
  const [showOriginal, setShowOriginal] = useState(false);
  const [detail, setDetail] = useState(step.detail);
  const [title, setTitle] = useState('');
  const [categoryId, setCategoryId] = useState<string | null>(null);

  // 원본 이미지 비율을 그대로 컨테이너에 적용 → 세로/가로 사진 모두 자연스럽게
  const photoAspect =
    step.photo.naturalWidth && step.photo.naturalHeight
      ? step.photo.naturalWidth / step.photo.naturalHeight
      : 1;

  // 사용자 도안만 보이는 카테고리 후보 (전체 + "내 도안")
  const usableCategories = categories.filter((c) => c.name !== '내 도안').concat(
    categories.filter((c) => c.name === '내 도안'),
  );

  return (
    <div className="mt-6 max-w-2xl mx-auto flex flex-col items-center gap-4">
      <div
        className="relative bg-white rounded-2xl shadow overflow-hidden grid place-items-center max-h-[65vh] max-w-full"
        style={{ aspectRatio: photoAspect }}
        onPointerDown={() => setShowOriginal(true)}
        onPointerUp={() => setShowOriginal(false)}
        onPointerLeave={() => setShowOriginal(false)}
      >
        <img
          src={showOriginal ? step.photoObjectUrl : step.outlineUrl}
          alt={showOriginal ? '원본' : '결과'}
          className="w-full h-full object-contain select-none"
          draggable={false}
        />
        <span className="absolute bottom-2 right-2 bg-black/60 text-white text-xs px-2 py-1 rounded-full">
          {showOriginal ? '원본' : '결과'} (꾹 누르면 원본 보기)
        </span>
      </div>

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

      <p className="text-sm text-app-text/60 text-center px-4">
        ⚠️ 사진 종류에 따라 결과가 다릅니다. 별로면 다른 사진으로 시도해 보세요.
      </p>

      <div className="flex gap-2 flex-wrap justify-center">
        <button
          type="button"
          onClick={() => onRetry(detail)}
          className="kid-btn bg-white px-5 py-2"
        >
          🔄 다시 변환
        </button>
        <button
          type="button"
          onClick={onCancel}
          className="kid-btn bg-app-danger text-white px-5 py-2"
        >
          ❌ 별로예요
        </button>
      </div>

      {/* 저장 폼 */}
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
