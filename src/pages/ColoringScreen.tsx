import { Link, useParams } from 'react-router-dom';

export default function ColoringScreen() {
  const { pageId } = useParams();
  return (
    <div className="h-full flex flex-col bg-app-bg">
      <header className="h-touch-lg flex items-center px-4 gap-2 border-b">
        <Link to="/" className="kid-btn bg-white px-4 py-2">
          🏠
        </Link>
        <div className="flex-1" />
        <button className="kid-btn bg-white px-4 py-2">↩️</button>
        <button className="kid-btn bg-white px-4 py-2">↪️</button>
        <button className="kid-btn bg-app-orange text-white px-4 py-2">💾</button>
      </header>

      <main className="flex-1 grid place-items-center">
        <p className="text-kid-body">TODO: 캔버스 (도안 {pageId ?? '?'})</p>
      </main>

      <footer className="h-40 border-t">
        <div className="h-touch-lg flex items-center gap-2 px-4">
          <span className="text-kid-body">색상 팔레트 (TODO)</span>
        </div>
        <div className="h-touch-lg flex items-center gap-2 px-4">
          <span className="text-kid-body">도구 (TODO)</span>
        </div>
      </footer>
    </div>
  );
}
