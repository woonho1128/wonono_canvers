import { Link, useParams } from 'react-router-dom';

export default function PageGrid() {
  const { categoryId } = useParams();
  return (
    <div className="min-h-full p-6">
      <Link to="/categories" className="kid-btn bg-white px-4 py-2">⬅️ 카테고리</Link>
      <h1 className="text-kid-title mt-6">도안 ({categoryId ?? 'all'})</h1>
      <p className="text-kid-body mt-2">TODO: 도안 썸네일 그리드 + 이어 그리기 카드</p>
    </div>
  );
}
