#!/usr/bin/env node
/**
 * OpenCV.js를 public/cv/에 다운로드.
 *
 * - 8MB 이상이라 git에 커밋하지 않음 (.gitignore)
 * - 첫 셋업 시 한 번 실행: npm run fetch:opencv
 * - 이미 있으면 skip (멱등)
 */

import { writeFile, mkdir, stat } from 'node:fs/promises';
import { join, dirname } from 'node:path';

const VERSION = '4.10.0';
const URL = `https://docs.opencv.org/${VERSION}/opencv.js`;
const ROOT = join(import.meta.dirname, '..');
const OUT_DIR = join(ROOT, 'public', 'cv');
const OUT = join(OUT_DIR, 'opencv.js');

async function fileExists(p) {
  try {
    const s = await stat(p);
    return s.isFile() && s.size > 1_000_000; // 1MB 미만이면 손상 — 재다운로드
  } catch {
    return false;
  }
}

async function main() {
  if (await fileExists(OUT)) {
    const s = await stat(OUT);
    console.log(`✓ opencv.js already present (${(s.size / 1024 / 1024).toFixed(1)} MB)`);
    return;
  }

  console.log(`→ fetching ${URL}`);
  await mkdir(dirname(OUT), { recursive: true });
  const res = await fetch(URL);
  if (!res.ok) {
    throw new Error(`HTTP ${res.status} from ${URL}`);
  }
  const buf = await res.arrayBuffer();
  await writeFile(OUT, Buffer.from(buf));
  const sizeMB = (buf.byteLength / 1024 / 1024).toFixed(1);
  console.log(`✓ ${OUT} (${sizeMB} MB)`);
}

main().catch((err) => {
  console.error('❌ fetch failed:', err.message ?? err);
  process.exit(1);
});
