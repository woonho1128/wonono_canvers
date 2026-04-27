import { Link } from 'react-router-dom';

export default function PhotoToOutline() {
  return (
    <div className="min-h-full p-6">
      <Link to="/parent" className="kid-btn bg-white px-4 py-2">⬅️ 부모 메뉴</Link>
      <h1 className="text-kid-title mt-6">사진으로 도안 만들기</h1>
      <p className="text-kid-body mt-2">TODO: 4단계 (선택 → 자르기 → 미리보기 → 저장)</p>
    </div>
  );
}
