export interface PaintColor {
  name: string;
  hex: string;
  cls: string; // tailwind bg-paint-*
}

export const PAINT_COLORS: readonly PaintColor[] = [
  { name: 'red', hex: '#E53935', cls: 'bg-paint-red' },
  { name: 'orange', hex: '#FB8C00', cls: 'bg-paint-orange' },
  { name: 'yellow', hex: '#FDD835', cls: 'bg-paint-yellow' },
  { name: 'lime', hex: '#9CCC65', cls: 'bg-paint-lime' },
  { name: 'green', hex: '#43A047', cls: 'bg-paint-green' },
  { name: 'sky', hex: '#29B6F6', cls: 'bg-paint-sky' },
  { name: 'blue', hex: '#1E88E5', cls: 'bg-paint-blue' },
  { name: 'purple', hex: '#8E24AA', cls: 'bg-paint-purple' },
  { name: 'pink', hex: '#EC407A', cls: 'bg-paint-pink' },
  { name: 'brown', hex: '#795548', cls: 'bg-paint-brown' },
  { name: 'gray', hex: '#9E9E9E', cls: 'bg-paint-gray' },
  { name: 'black', hex: '#212121', cls: 'bg-paint-black' },
] as const;
