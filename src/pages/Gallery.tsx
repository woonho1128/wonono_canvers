import { Link } from 'react-router-dom';
import { useAsyncData } from '@/hooks/useAsyncData';
import { AsyncBoundary } from '@/components/AsyncBoundary';
import { listArtworks } from '@/supabase/artworks';
import { publicUrl } from '@/supabase/storage';
import type { Artwork } from '@/supabase/types';

export default function Gallery() {
  const state = useAsyncData(listArtworks, []);

  return (
    <div className="min-h-full p-6">
      <Link to="/" className="kid-btn bg-white px-6 inline-flex items-center">
        🏠 홈
      </Link>
      <h1 className="text-kid-title mt-6 text-center">내 그림</h1>

      <AsyncBoundary state={state} loadingLabel="그림 가져오는 중...">
        {(artworks) =>
          artworks.length === 0 ? (
            <EmptyState />
          ) : (
            <div className="mt-8 grid grid-cols-2 sm:grid-cols-3 gap-6 max-w-4xl mx-auto">
              {artworks.map((a) => (
                <ArtworkCard key={a.id} artwork={a} />
              ))}
            </div>
          )
        }
      </AsyncBoundary>
    </div>
  );
}

function ArtworkCard({ artwork }: { artwork: Artwork }) {
  const src = artwork.thumbnail_path
    ? publicUrl('thumbnails', artwork.thumbnail_path)
    : publicUrl('artworks', artwork.image_path);
  return (
    <div className="bg-white aspect-square rounded-3xl shadow-sm overflow-hidden flex items-center justify-center">
      <img
        src={src}
        alt="내 그림"
        className="max-w-full max-h-full object-contain"
        loading="lazy"
      />
    </div>
  );
}

function EmptyState() {
  return (
    <div className="text-center mt-16">
      <div className="text-7xl">🎨</div>
      <p className="text-kid-body mt-4">아직 그림이 없어요</p>
      <p className="text-sm text-app-text/60 mt-2">색칠하기로 그려봐요!</p>
    </div>
  );
}
