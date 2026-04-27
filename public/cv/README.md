# OpenCV.js

`opencv.js` (9.9MB) is downloaded by `npm run fetch:opencv` and is **not** committed to git.

If missing, run:

```bash
npm run fetch:opencv
```

The PWA Service Worker caches it via the `opencv-wasm` runtime cache (vite.config.ts), so first load is slow but subsequent loads are instant.

Used by `src/cv/opencvLoader.ts` (dynamic script tag injection on PhotoToOutline page entry).
