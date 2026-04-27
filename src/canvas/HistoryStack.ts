/**
 * Undo/Redo 스택 (설계서 6.3)
 *
 * - ImageData 스냅샷 방식
 * - 단계 한도 15
 * - 총 메모리 한도 60MB (오래된 항목부터 제거)
 * - cursor: 현재 위치. push 시 cursor 이후(redo영역)는 잘림
 *
 * stroke 종료 / fill / eraser stroke 종료 시 push.
 * 첫 push에 "초기 상태"(빈 캔버스)를 넣어두는 것이 권장 — 그러면 첫 stroke 후
 * undo 시 빈 상태로 복귀 가능.
 */

export interface HistoryLimits {
  maxSteps: number;
  maxBytes: number;
}

const DEFAULT_LIMITS: HistoryLimits = {
  maxSteps: 15,
  maxBytes: 60 * 1024 * 1024,
};

export class HistoryStack {
  private stack: ImageData[] = [];
  private cursor = -1;
  readonly limits: HistoryLimits;

  constructor(limits: Partial<HistoryLimits> = {}) {
    this.limits = { ...DEFAULT_LIMITS, ...limits };
  }

  push(data: ImageData): void {
    // redo 영역 잘라냄
    if (this.cursor < this.stack.length - 1) {
      this.stack.length = this.cursor + 1;
    }
    this.stack.push(data);

    // 단계 한도 초과 → 오래된 것 제거
    while (this.stack.length > this.limits.maxSteps) {
      this.stack.shift();
    }
    // 메모리 한도 초과 → 오래된 것 제거 (단, 최소 1개는 유지)
    while (this.totalBytes() > this.limits.maxBytes && this.stack.length > 1) {
      this.stack.shift();
    }

    this.cursor = this.stack.length - 1;
  }

  undo(): ImageData | null {
    if (this.cursor <= 0) return null;
    this.cursor--;
    return this.stack[this.cursor];
  }

  redo(): ImageData | null {
    if (this.cursor >= this.stack.length - 1) return null;
    this.cursor++;
    return this.stack[this.cursor];
  }

  current(): ImageData | null {
    return this.stack[this.cursor] ?? null;
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

  get size(): number {
    return this.stack.length;
  }

  private totalBytes(): number {
    let total = 0;
    for (const d of this.stack) total += d.data.byteLength;
    return total;
  }
}
