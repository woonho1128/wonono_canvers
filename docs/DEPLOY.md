# 배포 가이드 (Vercel)

KidPaint를 Vercel에 배포하고 가족 전용으로 운영하는 절차.

---

## 1. GitHub 리포지토리 준비

Vercel은 GitHub repo와 연결해서 배포한다.

1. GitHub에 비공개 repo 생성 (예: `kidpaint`)
2. 로컬에서 push:
   ```bash
   git remote add origin git@github.com:<your-username>/kidpaint.git
   git push -u origin main
   ```
3. **`.env.local`은 `.gitignore`에 있으므로 절대 커밋되지 않음** — Vercel 환경변수에 직접 입력할 것

---

## 2. Vercel 프로젝트 생성

1. [vercel.com](https://vercel.com) 로그인 (GitHub 계정 연결 추천)
2. **Add New → Project** → kidpaint repo 선택
3. **Framework Preset**: **Vite** 자동 감지됨
4. **Build Command**: `npm run build` (기본값)
5. **Output Directory**: `dist` (기본값)
6. **Install Command**: `npm install` (기본값)

> ⚠️ `npm run fetch:opencv`는 빌드 전에 실행되어야 OpenCV.js가 dist에 포함됨. 다음 단계에서 추가.

---

## 3. 빌드 명령에 OpenCV 다운로드 끼우기

Vercel 빌드 시 `public/cv/opencv.js`가 없으면 사진→도안 기능 동작 X.

**옵션 A (권장)** — `package.json` 빌드 스크립트 수정:

```json
"build": "npm run fetch:opencv && tsc -b && vite build"
```

이 변경은 로컬 빌드에도 영향 X (멱등 — 이미 있으면 skip).

**옵션 B** — Vercel `installCommand`에 추가:

```
npm install && npm run fetch:opencv
```

옵션 A가 git history에 남아 자동화되니 추천.

---

## 4. 환경변수 입력

Vercel → Project → **Settings → Environment Variables**

| Key | Value | Environment |
|---|---|---|
| `VITE_SUPABASE_URL` | `https://...supabase.co` | Production, Preview, Development |
| `VITE_SUPABASE_ANON_KEY` | `sb_publishable_...` | Production, Preview, Development |
| `VITE_APP_NAME` | `조카 색칠놀이` | Production, Preview, Development |

저장 후 **Deployments → Redeploy** 한 번 실행.

---

## 5. 배포 후 검증

1. Vercel이 발급한 도메인 접속 (예: `kidpaint-xxx.vercel.app`)
2. 홈 → 색칠하기 → 카테고리 → 도안 → ColoringScreen에서 그리기 → 저장 → 갤러리 확인
3. 사진→도안: 첫 진입 시 OpenCV 9.9MB 다운로드 (~10초). 이후 SW 캐시
4. PWA 설치: 모바일 Safari/Chrome → 메뉴 → "홈 화면에 추가"

---

## 6. 가족 전용 운영 (필수)

배포 도메인은 기본적으로 **누구나 URL을 알면 접근 가능**. 가족 외 차단 위해 다음 모두 적용:

### 6.1 CORS 제한 (Supabase)

기본 CORS는 `*` (모든 origin 허용). 배포 도메인만 허용으로 잠그기.

> ⚠️ 2026-04 기준 Supabase는 대시보드에 직접 CORS 설정이 노출되지 않으며, **API Gateway 레벨 차단**은 무료티어에서 제한적.
>
> 대신 다음을 조합:
> - **URL 비공개**: 가족만 알게, 검색엔진 색인 차단 (이미 `<meta name="robots" content="noindex, nofollow">` 설정됨)
> - **공유 안 함**: SNS/블로그/링크 공유 절대 X
> - **Vercel Password Protection**: Pro 플랜이면 도메인에 비밀번호 설정 가능
> - **CloudFlare Access** 등으로 도메인 자체 보호 (고급)

### 6.2 검색엔진 색인 차단

`index.html`에 이미 적용되어 있음:
```html
<meta name="robots" content="noindex, nofollow" />
```

추가 안전망 — `public/robots.txt`:
```
User-agent: *
Disallow: /
```

### 6.3 도메인 정책

- 임의의 추측 어려운 서브도메인 사용 (예: `kidpaint-uno-fam.vercel.app`)
- Custom domain 연결 시도 가능 (예: `painting.unofam.com`)
- 가족에게만 공유, 즐겨찾기 권장

---

## 7. 운영 후 모니터링

| 자원 | 무료티어 | 모니터링 |
|---|---|---|
| Vercel 빌드 | 100/월 | Vercel 대시보드 → Usage |
| Vercel 대역폭 | 100 GB/월 | 충분 |
| Supabase DB | 500 MB | Supabase → Reports → Database |
| Supabase Storage | 1 GB | 도안/작품 누적 모니터링 |
| Supabase Egress | 5 GB/월 | 작품/도안 다운로드 합계 |

7일 이상 미사용 시 Supabase 무료 프로젝트가 일시정지됨 (원클릭 재개). 매일 사용한다면 영향 거의 없음.

---

## 8. 업데이트 / 새 도안 추가

### 새 시스템 도안 추가
1. `seed/outlines/<name>.svg` 추가
2. `scripts/seed-outlines.mjs` `SEEDS` 배열에 항목 추가
3. `npm run seed:outlines` (로컬에서 실행)

### 코드 업데이트
1. 로컬에서 변경 + commit
2. `git push` → Vercel 자동 배포
3. PWA SW: 배포 후 다음 홈 진입 시점에 자동 갱신 (작업 중에는 안 갱신, 설계서 10.3)

### 아이콘 디자인 변경
1. `seed/icons/icon.svg`, `icon-maskable.svg` 수정
2. `npm run build:icons`
3. 변경된 PNG 커밋 → 배포

---

## 트러블슈팅

| 증상 | 해결 |
|---|---|
| Vercel 빌드 실패: opencv.js missing | `package.json`의 `build` 스크립트가 `npm run fetch:opencv` 먼저 실행하는지 확인 |
| 첫 진입 SVG 안 보임 | Supabase URL/키 환경변수가 Vercel에 등록됐는지 확인 |
| 사진 변환 무반응 | 콘솔에 OpenCV 로드 실패 에러 확인. `/cv/opencv.js`가 dist에 포함됐는지 |
| 작품 저장 RLS 에러 | Supabase 마이그레이션이 적용됐는지 확인 (`docs/SUPABASE_SETUP.md`) |
