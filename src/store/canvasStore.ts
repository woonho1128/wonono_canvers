/**
 * 색칠 화면 상태 (설계서 3.2)
 *
 * - 현재 도구 / 색 / 굵기 / undo 가능 여부
 * - stroke 카운트 (UX용)
 *
 * TODO: 기능 붙이며 채워나간다.
 */

import { create } from 'zustand';

export type Tool = 'brush' | 'fill' | 'eraser';
export type BrushSize = 'thin' | 'medium' | 'thick';

interface CanvasState {
  tool: Tool;
  color: string; // hex
  brushSize: BrushSize;
  canUndo: boolean;
  canRedo: boolean;
  strokeCount: number;
  setTool: (t: Tool) => void;
  setColor: (c: string) => void;
  setBrushSize: (s: BrushSize) => void;
  setUndoRedo: (canUndo: boolean, canRedo: boolean) => void;
  incrementStroke: () => void;
  reset: () => void;
}

export const useCanvasStore = create<CanvasState>((set) => ({
  tool: 'brush',
  color: '#E53935',
  brushSize: 'medium',
  canUndo: false,
  canRedo: false,
  strokeCount: 0,
  setTool: (tool) => set({ tool }),
  setColor: (color) => set({ color }),
  setBrushSize: (brushSize) => set({ brushSize }),
  setUndoRedo: (canUndo, canRedo) => set({ canUndo, canRedo }),
  incrementStroke: () => set((s) => ({ strokeCount: s.strokeCount + 1 })),
  reset: () => set({ tool: 'brush', brushSize: 'medium', canUndo: false, canRedo: false, strokeCount: 0 }),
}));
