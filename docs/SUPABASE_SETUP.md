# Supabase 셋업 가이드

KidPaint를 새 환경(다른 컴퓨터, 새 프로젝트, 재구축)에서 처음부터 셋업하는 절차.

현재 운영 프로젝트 (2026-04-27 기준):

- 이름: `kidpaint`
- Region: Northeast Asia (Seoul)
- URL: `https://jknmpuklsbbtucapnwqu.supabase.co`

---

## 1. 프로젝트 생성

[supabase.com/dashboard](https://supabase.com/dashboard) → `New project`

| 필드 | 값 |
| ---- | -- |
| Project name | `kidpaint` |
| Database password | 강한 패스워드, 1Password 등에 백업 |
| Region | Northeast Asia (Seoul) — 한국 사용자 latency 최적 |
| Enable Data API | ✅ |
| Automatically expose new tables | ✅ |
| Enable automatic RLS | ✅ (안전망) |

생성 후 `Status: Healthy` 가 될 때까지 1~2분 대기.

## 2. API 키 복사

좌측 사이드바 ⚙️ Settings → API

복사할 것:

- **Project URL** (`https://...supabase.co`)
- **Publishable key** (`sb_publishable_...`로 시작)

⚠️ **Secret key는 절대 클라이언트에 들어가면 안 됨** — RLS 우회 가능. 서버 전용.

## 3. 로컬 환경변수

프로젝트 루트의 `.env.local`:

```
VITE_SUPABASE_URL=https://<project-ref>.supabase.co
VITE_SUPABASE_ANON_KEY=sb_publishable_...

VITE_APP_NAME=조카 색칠놀이
```

`.env.local`은 `.gitignore`에 등록되어 있으므로 절대 커밋되지 않음.

## 4. 마이그레이션 적용

좌측 사이드바 📝 SQL Editor → `+ New query`

[supabase/migrations/0001_init.sql](../supabase/migrations/0001_init.sql) 전체 내용 복사 → 붙여넣기 → `Run` (또는 Ctrl+Enter)

성공 메시지 확인 후 검증:

- 📋 Table Editor → `categories` 에 5개 row (동물 / 탈것 / 공룡 / 음식 / 내 도안)
- 📋 Table Editor → `coloring_pages`, `artworks` 테이블 존재 (비어있음)
- 🪣 Storage → 버킷 3개 (`outlines`, `artworks`, `thumbnails`) 존재
- 🔐 Authentication → Policies → 각 테이블/버킷에 정책 부착됨

## 5. 시드 도안 업로드

```bash
npm run seed:outlines
```

`seed/outlines/*.svg` 의 도안을 Storage `outlines/system/` 으로 업로드 + `coloring_pages` 에 row 추가. 멱등이라 여러 번 실행 안전.

새 도안 추가 절차:

1. `seed/outlines/<name>.svg` 추가
2. `scripts/seed-outlines.mjs` 의 `SEEDS` 배열에 항목 추가
3. `npm run seed:outlines`

## 6. 운영 설정 (배포 전)

### CORS 제한

좌측 사이드바 ⚙️ Settings → API → **Allowed origins** 에 배포 도메인만 등록.

기본은 `*` (전체 허용) — 가족 전용으로 운영하려면 반드시 도메인 1개로 제한할 것.

```
https://kidpaint.example.com
```

### 무료티어 한도 (2026 기준)

| 자원 | 한도 | 모니터링 |
| ---- | ---- | -------- |
| DB | 500 MB | Settings → Usage |
| Storage | 1 GB | Storage 페이지 상단 |
| Egress | 5 GB/월 | Settings → Usage |
| 동시 접속 | 60 connections | 거의 안 차오름 |

도안/작품이 많아지면 작품 PNG 압축 (WebP 변환) 또는 유료 플랜 검토.

### 일시정지 정책

7일 이상 활동 없으면 무료 프로젝트 자동 일시정지 (데이터는 보존). 클릭 한 번으로 재개.

KidPaint는 매일 사용 예정이라 거의 안 걸리지만, 휴가 등으로 막혔다면 `Restore project` 클릭.

---

## 트러블슈팅

| 증상 | 원인 / 해결 |
| ---- | ----------- |
| `npm run seed:outlines` 가 RLS 에러 | 마이그레이션이 적용되지 않았거나 정책이 반영되지 않음. SQL Editor에서 마이그레이션 재실행. |
| Storage 업로드 403 | 버킷이 없거나 Storage 정책이 빠짐. `0001_init.sql` 의 5~6번 섹션만 다시 실행. |
| 클라이언트에서 401 | 키 형식 확인. `sb_publishable_*` 가 맞는지, `sb_secret_*` 를 잘못 넣지 않았는지. |
| 카테고리 5개가 아닌 다른 수 | `0001_init.sql` 의 `on conflict do nothing` 때문에 멱등. 중복 실행은 무해. |
