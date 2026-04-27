#!/usr/bin/env node
/**
 * SVG 아이콘 → PWA용 PNG 자산 생성.
 *
 * - seed/icons/icon.svg → public/icons/icon-192.png (192x192, any)
 * - seed/icons/icon.svg → public/icons/icon-512.png (512x512, any)
 * - seed/icons/icon-maskable.svg → public/icons/icon-512-maskable.png (512x512, maskable)
 * - seed/icons/icon.svg → public/favicon.svg (그대로 복사 — 브라우저 favicon)
 *
 * 실행: npm run build:icons
 */

import sharp from 'sharp';
import { readFile, writeFile, mkdir, copyFile } from 'node:fs/promises';
import { join, dirname } from 'node:path';

const ROOT = join(import.meta.dirname, '..');
const SEED = join(ROOT, 'seed', 'icons');
const OUT = join(ROOT, 'public', 'icons');

const TARGETS = [
  { src: 'icon.svg', out: 'icon-192.png', size: 192 },
  { src: 'icon.svg', out: 'icon-512.png', size: 512 },
  { src: 'icon-maskable.svg', out: 'icon-512-maskable.png', size: 512 },
];

async function main() {
  await mkdir(OUT, { recursive: true });
  await mkdir(dirname(join(ROOT, 'public', 'favicon.svg')), { recursive: true });

  for (const t of TARGETS) {
    const buf = await readFile(join(SEED, t.src));
    const png = await sharp(buf, { density: 384 }).resize(t.size, t.size).png({ compressionLevel: 9 }).toBuffer();
    const outPath = join(OUT, t.out);
    await writeFile(outPath, png);
    console.log(`  ✓ ${outPath} (${t.size}x${t.size}, ${(png.length / 1024).toFixed(1)} KB)`);
  }

  // favicon.svg 복사
  await copyFile(join(SEED, 'icon.svg'), join(ROOT, 'public', 'favicon.svg'));
  console.log(`  ✓ public/favicon.svg`);
}

main().catch((err) => {
  console.error('❌ build icons failed:', err);
  process.exit(1);
});
