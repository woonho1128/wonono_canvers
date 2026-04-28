import { useState, useEffect } from 'react';
import type { FormEvent } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { supabase } from '@/supabase/client';
import { useAuth } from '@/auth/AuthContext';
import { usernameToEmail } from '@/auth/identity';

export default function Login() {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [err, setErr] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const nav = useNavigate();
  const loc = useLocation();
  const { session } = useAuth();

  const from = (loc.state as { from?: string } | null)?.from ?? '/';

  useEffect(() => {
    if (session) nav(from, { replace: true });
  }, [session, from, nav]);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setErr(null);
    setLoading(true);
    const email = usernameToEmail(username);
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    setLoading(false);
    if (error) {
      setErr('아이디나 비밀번호가 달라요');
      return;
    }
    nav(from, { replace: true });
  }

  return (
    <div className="min-h-full bg-app-bg flex items-center justify-center p-6">
      <form
        onSubmit={handleSubmit}
        className="bg-white rounded-2xl p-8 w-full max-w-sm shadow-sm flex flex-col gap-4"
      >
        <h1 className="text-kid-title text-center">조카 색칠놀이</h1>
        <input
          type="text"
          autoComplete="username"
          placeholder="아이디"
          value={username}
          onChange={(e) => setUsername(e.target.value)}
          required
          autoFocus
          className="border-2 border-black/10 rounded-xl p-3 text-lg"
        />
        <input
          type="password"
          autoComplete="current-password"
          placeholder="비밀번호"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
          className="border-2 border-black/10 rounded-xl p-3 text-lg"
        />
        {err && <p className="text-red-600 text-sm text-center">{err}</p>}
        <button
          type="submit"
          disabled={loading}
          className="kid-btn bg-app-orange text-white py-3 disabled:opacity-50"
        >
          {loading ? '로그인 중...' : '로그인'}
        </button>
      </form>
    </div>
  );
}
