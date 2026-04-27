import { Link } from 'react-router-dom';

export default function ParentGate() {
  return (
    <div className="min-h-full p-6 grid place-items-center">
      <div className="text-center">
        <h1 className="text-kid-title">🔒 어른에게 물어보세요</h1>
        <p className="text-kid-body mt-4">TODO: 산수 게이트 (12+7=?)</p>
        <Link to="/" className="kid-btn bg-white inline-block px-4 py-2 mt-6">
          🏠 홈
        </Link>
      </div>
    </div>
  );
}
