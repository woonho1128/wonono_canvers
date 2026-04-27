import { Link } from 'react-router-dom';

export default function ParentDashboard() {
  return (
    <div className="min-h-full p-6">
      <Link to="/" className="kid-btn bg-white px-4 py-2">
        🏠 홈
      </Link>
      <h1 className="text-kid-title mt-6">부모 메뉴</h1>
      <ul className="mt-4 space-y-2 text-kid-body">
        <li>
          <Link to="/parent/photo-to-outline" className="underline">
            ✨ 사진으로 도안 만들기
          </Link>
        </li>
        <li>도안 관리 (TODO)</li>
        <li>작품 관리 (TODO)</li>
        <li>설정 (TODO)</li>
      </ul>
    </div>
  );
}
