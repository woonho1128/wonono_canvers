const PAINT_SWATCHES = [
  { name: 'red', cls: 'bg-paint-red' },
  { name: 'orange', cls: 'bg-paint-orange' },
  { name: 'yellow', cls: 'bg-paint-yellow' },
  { name: 'lime', cls: 'bg-paint-lime' },
  { name: 'green', cls: 'bg-paint-green' },
  { name: 'sky', cls: 'bg-paint-sky' },
  { name: 'blue', cls: 'bg-paint-blue' },
  { name: 'purple', cls: 'bg-paint-purple' },
  { name: 'pink', cls: 'bg-paint-pink' },
  { name: 'brown', cls: 'bg-paint-brown' },
  { name: 'gray', cls: 'bg-paint-gray' },
  { name: 'black', cls: 'bg-paint-black' },
] as const;

export default function App() {
  return (
    <div className="min-h-full p-6 bg-app-bg text-app-text">
      <h1 className="text-kid-title">조카 색칠놀이</h1>
      <p className="text-kid-body mt-2">스캐폴딩 OK. 다음 단계에서 라우팅과 홈 화면을 붙입니다.</p>

      <div className="mt-6 grid grid-cols-6 gap-2 max-w-md">
        {PAINT_SWATCHES.map((c) => (
          <div key={c.name} className={`w-16 h-16 rounded-full ${c.cls}`} aria-label={c.name} />
        ))}
      </div>
    </div>
  );
}
