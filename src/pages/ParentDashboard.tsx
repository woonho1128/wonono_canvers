import { Link, useNavigate } from 'react-router-dom';
import { supabase } from '@/supabase/client';
import { useAuth } from '@/auth/AuthContext';

export default function ParentDashboard() {
  const nav = useNavigate();
  const { session } = useAuth();
  const username = (session?.user.email ?? '').split('@')[0] || '';

  async function handleLogout() {
    await supabase.auth.signOut();
    nav('/login', { replace: true });
  }

  return (
    <div className="min-h-full p-6">
      <div className="flex items-center justify-between">
        <Link to="/" className="kid-btn bg-white px-4 py-2">
          🏠 홈
        </Link>
        <div className="flex items-center gap-3">
          {username && <span className="text-kid-body">👤 {username}</span>}
          <button
            type="button"
            onClick={handleLogout}
            className="kid-btn bg-white px-4 py-2"
          >
            로그아웃
          </button>
        </div>
      </div>
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
