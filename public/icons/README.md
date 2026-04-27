# PWA 아이콘 (TODO)

다음 파일이 필요합니다 (manifest에서 참조):

- `icon-192.png` — 192x192, any purpose
- `icon-512.png` — 512x512, any purpose
- `icon-512-maskable.png` — 512x512, maskable (안전 영역 80% 안쪽에 핵심 그래픽)

**제작 가이드**

- 배경색: `#FFF8E7` (앱 배경)
- 메인 색상: `#FF9F43` (앱 강조)
- maskable은 Android 적응형 아이콘 — 둥근 마스크 / 사각 마스크 등 다양한 모양으로 잘려도 핵심이 보이게
- https://maskable.app 에서 maskable 생성/검증 가능
- 최종은 `pngquant` 또는 `oxipng`로 압축 권장

지금은 임시로 `icon-placeholder.svg` 1개만 두고, 정식 아이콘은 v0.2 마일스톤에서 교체.
