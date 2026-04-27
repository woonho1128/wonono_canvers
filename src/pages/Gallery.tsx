import { Link } from 'react-router-dom';

export default function Gallery() {
  return (
    <div className="min-h-full p-6">
      <Link to="/" className="kid-btn bg-white px-4 py-2">🏠 홈</Link>
      <h1 className="text-kid-title mt-6">내 그림</h1>
      <p className="text-kid-body mt-2">TODO: 작품 그리드</p>
    </div>
  );
}
