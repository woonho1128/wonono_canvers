/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        // 앱 UI 컬러 (8.2)
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
      },
      // 5세 터치 타겟 (8.4)
      spacing: {
        'touch': '60px',
        'touch-lg': '80px',
        'tile': '240px',
        'menu': '200px',
      },
      // 큰 글자 우선 (8.3)
      fontSize: {
        'kid-body': ['18px', { lineHeight: '1.5', fontWeight: '700' }],
        'kid-btn': ['24px', { lineHeight: '1.3', fontWeight: '700' }],
        'kid-title': ['32px', { lineHeight: '1.3', fontWeight: '800' }],
      },
    },
  },
  plugins: [],
};
