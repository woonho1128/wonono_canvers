import { Link } from 'react-router-dom';

export default function Home() {
  return (
    <div className="min-h-full p-6 bg-app-bg flex flex-col items-center justify-center gap-6">
      <h1 className="text-kid-title">조카 색칠놀이</h1>
      <div className="flex flex-wrap gap-6 justify-center">
        <Link
          to="/categories"
          className="kid-btn bg-app-orange text-white w-menu h-menu flex items-center justify-center"
        >
          🎨 색칠하기
        </Link>
        <Link
          to="/gallery"
          className="kid-btn bg-app-mint text-white w-menu h-menu flex items-center justify-center"
        >
          🖼️ 그림 보기
        </Link>
        <Link
          to="/parent"
          className="kid-btn bg-app-text text-white w-menu h-menu flex items-center justify-center"
        >
          👤 어른
        </Link>
      </div>
    </div>
  );
}
