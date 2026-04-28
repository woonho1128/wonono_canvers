# 사진 → 도안 (고품질 변환, Replicate API)

PhotoToOutline 페이지의 **고품질 변환(AI)** 모드는 Replicate의 `flux-kontext-pro` 모델을 호출한다. 토큰을 클라이언트에 노출하지 않으려고 Supabase Edge Function `photo-to-outline`을 프록시로 둔다.

```
[브라우저] ──fetch(base64)──► [Edge Function] ──https──► [Replicate API]
                                토큰은 여기만 알고 있음
```

3가지 모드:
- **빠른 변환 (무료)** — 기존 OpenCV.js 클라이언트 변환, 비용 0
- **고품질 변환 (AI)** — 이 문서, 호출당 약 $0.04
- **도안 직접 업로드** — 변환 없이 PNG 그대로 등록

---

## 1. Replicate 토큰 발급

1. [replicate.com](https://replicate.com) 가입/로그인
2. Account → API tokens → `Create token`
3. 토큰 값 복사 (`r8_...`로 시작). **절대 git에 커밋 X.**
4. Replicate 대시보드에서 결제 카드 등록 (free credit 소진 후 과금)

호출당 비용: 약 **$0.04 / output image** (2026-04 기준, 모델 페이지 표기 기준).

## 2. Edge Function 배포

프로젝트 파일이 있는 머신에서:

```bash
# 처음 1번만
npm install --save-dev supabase
npx supabase login
npx supabase link --project-ref <project-ref>   # 대시보드 URL의 ID

# 토큰 등록 (코드와 분리되어 Supabase 클라우드에만 저장됨)
npx supabase secrets set REPLICATE_API_TOKEN=r8_xxxxx

# 배포 (Edge Function 코드 수정할 때마다)
npx supabase functions deploy photo-to-outline
```

> 💡 토큰은 Supabase 웹 대시보드 → Edge Functions → Manage secrets 에서도 등록 가능.

## 3. 배포 검증

```bash
curl -X POST \
  -H "Authorization: Bearer <SUPABASE_ANON_KEY>" \
  -H "Content-Type: application/json" \
  -d '{"image":"https://replicate.delivery/.../sample.png"}' \
  https://<project-ref>.functions.supabase.co/photo-to-outline \
  --output test-outline.png
```

성공 시 `test-outline.png`로 도안이 저장된다. 실패 시 본문은 JSON 에러.

## 4. 환경 변수

Edge Function이 읽는 환경 변수 (Supabase secrets로 등록):

| 키 | 필수 | 설명 |
|---|---|---|
| `REPLICATE_API_TOKEN` | ✅ | Replicate API 토큰 |
| `ALLOWED_ORIGINS` | 선택 | CORS 화이트리스트 (콤마 구분). 미설정시 `*`. 운영 도메인이 정해지면 등록 권장 |

`ALLOWED_ORIGINS` 예:
```
npx supabase secrets set ALLOWED_ORIGINS=https://kidpaint.example.com,http://localhost:5173
```

## 5. 비용 통제

- 1회 호출 약 $0.04 → 100회 = $4
- Replicate 대시보드 → Settings → **Spend limit** 설정 권장 (예: 월 $5)
- Edge Function 자체엔 rate limit 없음 — 가족 전용이라 OK지만, 도메인 노출되면 추가 보호 필요

## 6. 모델 / 프롬프트 변경

`supabase/functions/photo-to-outline/index.ts` 의 `MODEL`, `DEFAULT_PROMPT` 상수를 수정 후 재배포.

다른 후보 모델:
- `black-forest-labs/flux-canny-pro` — Canny edge 기반, 구조 보존이 더 강함
- ControlNet lineart 계열 — 순수 라인만 추출 (스타일은 덜 귀여움)

클라이언트에서 호출 시 `prompt`를 함께 보내면 그게 우선 적용됨 (`apiConverter.ts`의 `convertPhotoToOutlineApi(photo, prompt)`).

---

## 트러블슈팅

| 증상 | 원인 / 해결 |
|---|---|
| `REPLICATE_API_TOKEN not configured` | secrets 등록 안 됨. `npx supabase secrets list`로 확인 후 set |
| `Replicate error: 402` | 결제 정보 미등록 또는 spend limit 도달 |
| `Image too large (>~9MB)` | 사진 크기를 줄여서 재시도. 클라이언트에서 리사이즈 추가 검토 |
| `Conversion timed out` | 서버 부하 또는 모델 응답 지연. 다시 시도 |
| CORS 에러 | `ALLOWED_ORIGINS`에 현재 origin 추가 (또는 `*`) |
