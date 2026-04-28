/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        // 앱 UI 컬러 (8.2) — 기존 화면 호환
        app: {
          bg: '#FFF8E7',
          orange: '#FF9F43',
          mint: '#26C6A8',
          text: '#3D3D3D',
          danger: '#FF6B6B',
        },
        // 색칠 팔레트 12색 (8.2)
        paint: {
          red: '#E53935',
          orange: '#FB8C00',
          yellow: '#FDD835',
          lime: '#9CCC65',
          green: '#43A047',
          sky: '#29B6F6',
          blue: '#1E88E5',
          purple: '#8E24AA',
          pink: '#EC407A',
          brown: '#795548',
          gray: '#9E9E9E',
          black: '#212121',
        },
        // ─── 새 디자인 토큰 (Claude Design 시안) ──────
        cream: '#FFF6E9',
        peach: '#FFE8D6',
        soft: '#FFF0DA',
        kid: {
          orange: { DEFAULT: '#FF9F45', deep: '#F26B3A', shadow: '#E8814A' },
          yellow: { DEFAULT: '#FFD93D', soft: '#FFE680', shadow: '#E8B82C' },
          ink: { DEFAULT: '#4A3525', soft: '#8B6E5A', faint: '#C9B5A3' },
        },
      },
      fontFamily: {
        sans: [
          'Pretendard Variable',
          'Pretendard',
          'system-ui',
          '-apple-system',
          'BlinkMacSystemFont',
          'sans-serif',
        ],
        // ─── 새 디자인용 폰트 ─────────────────────
        hand: ['Gaegu', 'Pretendard Variable', 'cursive'],
        round: ['Fredoka', 'Pretendard Variable', 'sans-serif'],
        display: ['Nunito', 'Pretendard Variable', 'sans-serif'],
      },
      // 5세 터치 타겟 (8.4)
      spacing: {
        touch: '60px',
        'touch-lg': '80px',
        tile: '240px',
        menu: '200px',
        tap: '64px',
      },
      // 큰 글자 우선 (8.3)
      fontSize: {
        'kid-body': ['18px', { lineHeight: '1.5', fontWeight: '700' }],
        'kid-btn': ['24px', { lineHeight: '1.3', fontWeight: '700' }],
        'kid-title': ['32px', { lineHeight: '1.3', fontWeight: '800' }],
      },
      borderRadius: {
        chunky: '28px',
        canvas: '32px',
      },
      boxShadow: {
        chunky: '0 6px 0 #E5D4BD',
        'chunky-orange': '0 6px 0 #E8814A',
        'chunky-yellow': '0 6px 0 #E8B82C',
        'chunky-soft': '0 8px 24px rgba(74,53,37,0.18)',
      },
      minWidth: { tap: '64px' },
      minHeight: { tap: '64px' },
    },
  },
  plugins: [],
};
