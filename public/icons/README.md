# PWA 아이콘

`npm run build:icons`로 자동 생성됨 (sharp 사용).

생성되는 파일:
- `icon-192.png` — 192x192, any purpose (manifest 기본)
- `icon-512.png` — 512x512, any purpose
- `icon-512-maskable.png` — 512x512, maskable (Android 적응형 마스크 안전 영역 80%)

원본:
- `seed/icons/icon.svg` — 메인 디자인 (any)
- `seed/icons/icon-maskable.svg` — maskable 버전 (안전 영역 80%)

디자인을 바꾸려면:
1. `seed/icons/*.svg` 수정
2. `npm run build:icons` 재실행
3. 빌드 → 새 PNG가 `dist/`에 포함됨
