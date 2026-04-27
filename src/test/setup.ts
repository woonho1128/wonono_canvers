import '@testing-library/jest-dom';

// jsdom은 ImageData를 제공하지 않음 — HistoryStack 등 캔버스 로직 테스트용 polyfill.
if (typeof globalThis.ImageData === 'undefined') {
  class ImageDataPolyfill {
    readonly data: Uint8ClampedArray;
    readonly width: number;
    readonly height: number;
    readonly colorSpace = 'srgb' as const;

    constructor(...args: unknown[]) {
      if (args[0] instanceof Uint8ClampedArray) {
        this.data = args[0];
        this.width = args[1] as number;
        this.height = (args[2] as number | undefined) ?? this.data.length / 4 / this.width;
      } else {
        this.width = args[0] as number;
        this.height = args[1] as number;
        this.data = new Uint8ClampedArray(this.width * this.height * 4);
      }
    }
  }
  (globalThis as { ImageData: unknown }).ImageData = ImageDataPolyfill;
}
