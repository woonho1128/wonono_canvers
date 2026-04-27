import { Link } from 'react-router-dom';

export default function CategorySelect() {
  return (
    <div className="min-h-full p-6">
      <Link to="/" className="kid-btn bg-white px-4 py-2">🏠 홈</Link>
      <h1 className="text-kid-title mt-6">카테고리</h1>
      <p className="text-kid-body mt-2">TODO: 카테고리 그리드</p>
    </div>
  );
}
