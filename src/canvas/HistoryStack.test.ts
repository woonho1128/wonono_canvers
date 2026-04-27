import { HistoryStack } from './HistoryStack';

function makeImageData(byte = 1, width = 4, height = 4): ImageData {
  const arr = new Uint8ClampedArray(width * height * 4);
  arr.fill(byte);
  return new ImageData(arr, width, height);
}

describe('HistoryStack', () => {
  it('초기 상태는 undo/redo 모두 불가', () => {
    const h = new HistoryStack();
    expect(h.canUndo).toBe(false);
    expect(h.canRedo).toBe(false);
    expect(h.current()).toBeNull();
  });

  it('첫 push 후에도 undo는 불가 (이전 상태 없음)', () => {
    const h = new HistoryStack();
    h.push(makeImageData(1));
    expect(h.canUndo).toBe(false);
    expect(h.canRedo).toBe(false);
  });

  it('두 번째 push부터 undo 가능', () => {
    const h = new HistoryStack();
    h.push(makeImageData(1));
    h.push(makeImageData(2));
    expect(h.canUndo).toBe(true);
    expect(h.canRedo).toBe(false);

    const prev = h.undo();
    expect(prev?.data[0]).toBe(1);
    expect(h.canUndo).toBe(false);
    expect(h.canRedo).toBe(true);
  });

  it('undo 후 redo 동작', () => {
    const h = new HistoryStack();
    h.push(makeImageData(1));
    h.push(makeImageData(2));
    h.push(makeImageData(3));

    expect(h.undo()?.data[0]).toBe(2);
    expect(h.undo()?.data[0]).toBe(1);
    expect(h.undo()).toBeNull();
    expect(h.redo()?.data[0]).toBe(2);
    expect(h.redo()?.data[0]).toBe(3);
    expect(h.redo()).toBeNull();
  });

  it('undo 중 push 하면 redo 영역이 잘림', () => {
    const h = new HistoryStack();
    h.push(makeImageData(1));
    h.push(makeImageData(2));
    h.push(makeImageData(3));
    h.undo(); // cursor at 1 (data 2)
    h.push(makeImageData(9));

    expect(h.canRedo).toBe(false);
    expect(h.size).toBe(3); // 1, 2, 9
    expect(h.current()?.data[0]).toBe(9);
  });

  it('단계 한도 초과 시 오래된 것부터 제거', () => {
    const h = new HistoryStack({ maxSteps: 3 });
    h.push(makeImageData(1));
    h.push(makeImageData(2));
    h.push(makeImageData(3));
    h.push(makeImageData(4));

    expect(h.size).toBe(3);
    // 가장 오래된 1이 빠짐
    h.undo();
    h.undo();
    expect(h.current()?.data[0]).toBe(2);
  });

  it('메모리 한도 초과 시 오래된 것부터 제거', () => {
    const oneFrameBytes = 4 * 4 * 4; // 4x4 RGBA
    const h = new HistoryStack({ maxSteps: 100, maxBytes: oneFrameBytes * 2 });

    h.push(makeImageData(1));
    h.push(makeImageData(2));
    h.push(makeImageData(3)); // 3개째가 들어가면 한도 초과

    expect(h.size).toBe(2); // 1이 제거되고 2,3 남음
    expect(h.current()?.data[0]).toBe(3);
  });

  it('clear는 모든 상태 초기화', () => {
    const h = new HistoryStack();
    h.push(makeImageData(1));
    h.push(makeImageData(2));
    h.clear();

    expect(h.size).toBe(0);
    expect(h.canUndo).toBe(false);
    expect(h.canRedo).toBe(false);
    expect(h.current()).toBeNull();
  });
});
