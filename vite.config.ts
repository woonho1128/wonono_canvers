import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import tsconfigPaths from 'vite-tsconfig-paths';
import { VitePWA } from 'vite-plugin-pwa';

export default defineConfig({
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./src/test/setup.ts'],
    css: false,
  },
  plugins: [
    react(),
    tsconfigPaths(),
    VitePWA({
      // 그리는 중 새 SW가 활성화되어 캔버스 상태가 유실되지 않도록
      // 'prompt' 모드로 두고, 적용 시점은 앱이 직접 결정한다 (10.3).
      registerType: 'prompt',
      injectRegister: false,
      strategies: 'generateSW',
      workbox: {
        // 큰 폰트 파일은 precache에서 제외 (브라우저 자체 캐시에 맡김)
        globPatterns: ['**/*.{js,css,html,svg,png,ico}'],
        globIgnores: ['**/PretendardVariable*'],
        // 앱은 SPA — 모든 라우트는 index.html로 fallback
        navigateFallback: '/index.html',
        cleanupOutdatedCaches: true,
        runtimeCaching: [
          // OpenCV.js wasm — 한 번 받으면 재사용
          {
            urlPattern: /opencv.*\.js$/,
            handler: 'CacheFirst',
            options: {
              cacheName: 'opencv-wasm',
              expiration: { maxEntries: 4, maxAgeSeconds: 60 * 60 * 24 * 365 },
            },
          },
          // Supabase Storage — 도안 (immutable, CacheFirst)
          {
            urlPattern: /\/storage\/v1\/object\/public\/outlines\//,
            handler: 'CacheFirst',
            options: {
              cacheName: 'outlines',
              expiration: { maxEntries: 200, maxAgeSeconds: 60 * 60 * 24 * 90 },
            },
          },
          // Supabase Storage — 썸네일
          {
            urlPattern: /\/storage\/v1\/object\/public\/thumbnails\//,
            handler: 'StaleWhileRevalidate',
            options: {
              cacheName: 'thumbnails',
              expiration: { maxEntries: 500, maxAgeSeconds: 60 * 60 * 24 * 30 },
            },
          },
          // Supabase Storage — 작품 (최신 우선)
          {
            urlPattern: /\/storage\/v1\/object\/public\/artworks\//,
            handler: 'NetworkFirst',
            options: {
              cacheName: 'artworks',
              networkTimeoutSeconds: 5,
              expiration: { maxEntries: 200, maxAgeSeconds: 60 * 60 * 24 * 30 },
            },
          },
          // Pretendard woff2 (lazy loaded by @font-face)
          {
            urlPattern: /Pretendard.*\.woff2$/,
            handler: 'CacheFirst',
            options: {
              cacheName: 'fonts',
              expiration: { maxEntries: 4, maxAgeSeconds: 60 * 60 * 24 * 365 },
            },
          },
        ],
      },
      manifest: {
        name: '조카 색칠놀이',
        short_name: '색칠놀이',
        description: '5세 아동용 태블릿 색칠놀이',
        start_url: '/',
        scope: '/',
        display: 'standalone',
        orientation: 'landscape',
        background_color: '#FFF8E7',
        theme_color: '#FF9F43',
        lang: 'ko',
        dir: 'ltr',
        icons: [
          { src: '/icons/icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: '/icons/icon-512.png', sizes: '512x512', type: 'image/png' },
          {
            src: '/icons/icon-512-maskable.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'maskable',
          },
        ],
      },
      devOptions: {
        // 개발 중에는 PWA 기본 비활성 (필요시 true로)
        enabled: false,
      },
    }),
  ],
});
