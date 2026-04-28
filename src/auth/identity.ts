// Supabase Auth는 이메일을 식별자로 사용. 아이디 → 가짜 도메인 이메일로 매핑.
const PSEUDO_DOMAIN = 'kidpaint.local';

export function usernameToEmail(username: string): string {
  return `${username.trim().toLowerCase()}@${PSEUDO_DOMAIN}`;
}
