import { floodFillWithMask } from './floodFill';

/**
 * jsdom 환경에서 CanvasRenderingContext2D를 직접 만드는 건 무겁다.
 * 그래서 `getImageData` / `putImageData`만 흉내내는 fake context로 테스트한다.
 */
function makeFakeCtx(width: number, height: number) {
  const buf = new Uint8ClampedArray(width * height * 4);
  // 초기화: 흰색 + 불투명
  for (let i = 0; i < buf.length; i += 4) {
    buf[i] = 255;
    buf[i + 1] = 255;
    buf[i + 2] = 255;
    buf[i + 3] = 255;
  }
  return {
    getImageData: () => new ImageData(new Uint8ClampedArray(buf), width, height),
    putImageData: (img: ImageData) => {
      buf.set(img.data);
    },
    raw: buf,
  };
}

function pixelAt(buf: Uint8ClampedArray, w: number, x: number, y: number): [number, number, number, number] {
  const i = (y * w + x) * 4;
  return [buf[i], buf[i + 1], buf[i + 2], buf[i + 3]];
}

describe('floodFillWithMask', () => {
  it('마스크가 막힌 영역만 채우고 외곽선 너머는 안 건드림', () => {
    // 5x5 — 가운데 행/열에 외곽선 십자가
    //  . . X . .
    //  . . X . .
    //  X X X X X
    //  . . X . .
    //  . . X . .
    const w = 5,
      h = 5;
    const mask = new Uint8Array(w * h);
    for (let i = 0; i < w; i++) mask[2 * w + i] = 1;
    for (let i = 0; i < h; i++) mask[i * w + 2] = 1;

    const ctx = makeFakeCtx(w, h);
    const ok = floodFillWithMask({
      ctx: ctx as unknown as CanvasRenderingContext2D,
      mask,
      width: w,
      height: h,
      startX: 0,
      startY: 0,
      fillColor: [255, 0, 0, 255],
    });
    expect(ok).toBe(true);

    // 좌상단 quadrant는 빨강
    expect(pixelAt(ctx.raw, w, 0, 0)).toEqual([255, 0, 0, 255]);
    expect(pixelAt(ctx.raw, w, 1, 1)).toEqual([255, 0, 0, 255]);
    // 외곽선은 그대로
    expect(pixelAt(ctx.raw, w, 2, 2)[0]).toBe(255); // 흰색 그대로
    // 우하단 quadrant는 색칠 안 됨
    expect(pixelAt(ctx.raw, w, 4, 4)).toEqual([255, 255, 255, 255]);
    expect(pixelAt(ctx.raw, w, 3, 3)).toEqual([255, 255, 255, 255]);
  });

  it('시작점이 외곽선이면 채우지 않음', () => {
    const w = 3,
      h = 3;
    const mask = new Uint8Array(w * h);
    mask[4] = 1; // (1,1) 외곽선

    const ctx = makeFakeCtx(w, h);
    const ok = floodFillWithMask({
      ctx: ctx as unknown as CanvasRenderingContext2D,
      mask,
      width: w,
      height: h,
      startX: 1,
      startY: 1,
      fillColor: [0, 0, 255, 255],
    });
    expect(ok).toBe(false);
    // 변하지 않음
    expect(pixelAt(ctx.raw, w, 0, 0)).toEqual([255, 255, 255, 255]);
  });

  it('범위 밖 시작점은 noop', () => {
    const w = 3,
      h = 3;
    const mask = new Uint8Array(w * h);
    const ctx = makeFakeCtx(w, h);

    expect(
      floodFillWithMask({
        ctx: ctx as unknown as CanvasRenderingContext2D,
        mask,
        width: w,
        height: h,
        startX: -1,
        startY: 0,
        fillColor: [0, 0, 0, 255],
      }),
    ).toBe(false);
    expect(
      floodFillWithMask({
        ctx: ctx as unknown as CanvasRenderingContext2D,
        mask,
        width: w,
        height: h,
        startX: 0,
        startY: 5,
        fillColor: [0, 0, 0, 255],
      }),
    ).toBe(false);
  });

  it('외곽선이 닫힌 영역 — 안쪽만 채움', () => {
    // 5x5 박스 외곽선
    //  X X X X X
    //  X . . . X
    //  X . . . X
    //  X . . . X
    //  X X X X X
    const w = 5,
      h = 5;
    const mask = new Uint8Array(w * h);
    for (let i = 0; i < w; i++) {
      mask[i] = 1; // top
      mask[(h - 1) * w + i] = 1; // bottom
    }
    for (let i = 0; i < h; i++) {
      mask[i * w] = 1; // left
      mask[i * w + (w - 1)] = 1; // right
    }

    const ctx = makeFakeCtx(w, h);
    floodFillWithMask({
      ctx: ctx as unknown as CanvasRenderingContext2D,
      mask,
      width: w,
      height: h,
      startX: 2,
      startY: 2,
      fillColor: [0, 200, 0, 255],
    });

    // 안쪽 (1,1) ~ (3,3) 모두 초록
    for (let y = 1; y <= 3; y++) {
      for (let x = 1; x <= 3; x++) {
        expect(pixelAt(ctx.raw, w, x, y)).toEqual([0, 200, 0, 255]);
      }
    }
    // 외곽선은 그대로 (흰색)
    expect(pixelAt(ctx.raw, w, 0, 0)).toEqual([255, 255, 255, 255]);
  });
});
