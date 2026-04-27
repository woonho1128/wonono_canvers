/**
 * Undo/Redo 스택 (설계서 6.3)
 *
 * - ImageData 스냅샷 방식
 * - 단계 한도 15, 총 메모리 한도 60MB
 * - 한도 초과 시 오래된 항목부터 제거
 *
 * TODO: 3주차 구현.
 */

export class HistoryStack {
  private stack: ImageData[] = [];
  private cursor = -1;
  private readonly MAX_STEPS = 15;
  private readonly MAX_TOTAL_BYTES = 60 * 1024 * 1024;

  push(_data: ImageData): void {
    // TODO
  }

  undo(): ImageData | null {
    // TODO
    return null;
  }

  redo(): ImageData | null {
    // TODO
    return null;
  }

  clear(): void {
    this.stack = [];
    this.cursor = -1;
  }

  get canUndo(): boolean {
    return this.cursor > 0;
  }

  get canRedo(): boolean {
    return this.cursor < this.stack.length - 1;
  }

  // 한도 (테스트/디버그용)
  readonly limits = { maxSteps: this.MAX_STEPS, maxBytes: this.MAX_TOTAL_BYTES };
}
