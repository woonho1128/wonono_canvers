#!/usr/bin/env node
/**
 * 사용자 계정 시드 스크립트 (idempotent)
 *
 * 실행:
 *   npm run seed:users
 *
 * 필요 환경변수 (.env.local):
 *   VITE_SUPABASE_URL
 *   SUPABASE_SERVICE_ROLE_KEY  (Dashboard → Settings → API → service_role)
 *
 * 선택 환경변수 (덮어쓰기):
 *   YEHAN_PASSWORD, WOONHO_PASSWORD
 */

import { createClient } from '@supabase/supabase-js';

const url = process.env.VITE_SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!url || !serviceKey) {
  console.error('❌ VITE_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY 가 .env.local 에 없습니다.');
  console.error('   service_role 키는 Dashboard → Settings → API 페이지에서 복사하세요.');
  process.exit(1);
}

const admin = createClient(url, serviceKey, {
  auth: { persistSession: false, autoRefreshToken: false },
});

const PSEUDO_DOMAIN = 'kidpaint.local';

const USERS = [
  { username: 'yehan0204', password: process.env.YEHAN_PASSWORD ?? '112800' },
  { username: 'woonho1128', password: process.env.WOONHO_PASSWORD ?? '112800' },
];

async function findUserByEmail(email) {
  let page = 1;
  while (true) {
    const { data, error } = await admin.auth.admin.listUsers({ page, perPage: 200 });
    if (error) throw error;
    const found = data.users.find((u) => u.email?.toLowerCase() === email.toLowerCase());
    if (found) return found;
    if (data.users.length < 200) return null;
    page += 1;
  }
}

for (const u of USERS) {
  const email = `${u.username}@${PSEUDO_DOMAIN}`;
  const existing = await findUserByEmail(email);

  if (existing) {
    const { error } = await admin.auth.admin.updateUserById(existing.id, {
      password: u.password,
      email_confirm: true,
      user_metadata: { username: u.username },
    });
    if (error) {
      console.error(`✗ ${u.username}: ${error.message}`);
    } else {
      console.log(`↻ ${u.username} 비밀번호 갱신 (id=${existing.id})`);
    }
  } else {
    const { data, error } = await admin.auth.admin.createUser({
      email,
      password: u.password,
      email_confirm: true,
      user_metadata: { username: u.username },
    });
    if (error) {
      console.error(`✗ ${u.username}: ${error.message}`);
    } else {
      console.log(`✓ ${u.username} 생성 (id=${data.user.id})`);
    }
  }
}

console.log('\n완료. 로그인 페이지에서 아이디 + 비밀번호로 들어가면 됩니다.');
