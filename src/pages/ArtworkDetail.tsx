import { Link, useNavigate, useParams } from 'react-router-dom';
import { useState } from 'react';
import { useAsyncData } from '@/hooks/useAsyncData';
import { AsyncBoundary } from '@/components/AsyncBoundary';
import { HoldToConfirm } from '@/components/HoldToConfirm';
import { deleteArtwork, getArtworkById } from '@/supabase/artworks';
import { publicUrl } from '@/supabase/storage';

export default function ArtworkDetail() {
  const { artworkId } = useParams<{ artworkId: string }>();
  const state = useAsyncData(() => {
    if (!artworkId) throw new Error('작품 ID가 없어요');
    return getArtworkById(artworkId).then((a) => {
      if (!a) throw new Error('작품을 찾을 수 없어요');
      return a;
    });
  }, [artworkId]);

  return (
    <div className="h-full flex flex-col bg-app-bg">
      <AsyncBoundary state={state} loadingLabel="그림 가져오는 중...">
        {(artwork) => <Body artwork={artwork} />}
      </AsyncBoundary>
    </div>
  );
}

function Body({ artwork }: { artwork: { id: string; image_path: string; thumbnail_path: string | null } }) {
  const navigate = useNavigate();
  const [deleting, setDeleting] = useState(false);
  const src = publicUrl('artworks', artwork.image_path);

  const onDelete = async () => {
    if (deleting) return;
    setDeleting(true);
    try {
      await deleteArtwork({
        id: artwork.id,
        image_path: artwork.image_path,
        thumbnail_path: artwork.thumbnail_path,
        page_id: null,
        created_at: '',
      });
      navigate('/gallery');
    } catch (err) {
      console.error('delete failed:', err);
      setDeleting(false);
    }
  };

  const onPrint = () => {
    // 다음 frame에서 print() 호출 — 클릭 시각 효과/스타일이 먼저 반영되도록
    requestAnimationFrame(() => window.print());
  };

  return (
    <>
      <header className="h-touch-lg shrink-0 flex items-center px-2 gap-1 border-b border-black/10">
        <Link to="/gallery" className="kid-btn bg-white px-4 inline-flex items-center" aria-label="뒤로">
          ⬅️
        </Link>
        <div className="flex-1" />
        <button
          type="button"
          onClick={onPrint}
          className="kid-btn bg-white px-4 inline-flex items-center"
          aria-label="인쇄"
        >
          🖨️
        </button>
        <a
          href={src}
          download
          className="kid-btn bg-white px-4 inline-flex items-center"
          aria-label="다운로드"
        >
          ⬇️
        </a>
        <HoldToConfirm
          label="삭제 (길게 누르세요)"
          onConfirm={onDelete}
          disabled={deleting}
          className="bg-app-danger/10 ring-2 ring-app-danger"
        >
          🗑️
        </HoldToConfirm>
      </header>

      <main className="flex-1 grid place-items-center p-4 min-h-0 print-target">
        <img
          src={src}
          alt="내 그림"
          className="max-w-full max-h-full object-contain rounded-2xl shadow-md bg-white"
        />
      </main>

      {deleting && (
        <div className="fixed inset-0 bg-black/30 grid place-items-center z-20">
          <div className="bg-white p-6 rounded-2xl text-kid-body">🗑️ 지우는 중...</div>
        </div>
      )}
    </>
  );
}
