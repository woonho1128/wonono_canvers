#!/usr/bin/env node
/**
 * 시스템 도안 시드 스크립트
 *
 * 실행:
 *   npm run seed:outlines
 *
 * 동작:
 *   1) seed/outlines/*.svg 를 Storage `outlines/system/{file}` 에 업로드
 *   2) coloring_pages 에 row 추가 (source='default')
 *   3) outline_path 가 이미 있으면 스킵 (idempotent)
 *
 * 필요 환경변수 (.env.local):
 *   VITE_SUPABASE_URL
 *   VITE_SUPABASE_ANON_KEY
 */

import { createClient } from '@supabase/supabase-js';
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';

const url = process.env.VITE_SUPABASE_URL;
const key = process.env.VITE_SUPABASE_ANON_KEY;

if (!url || !key || url.includes('placeholder')) {
  console.error('❌ VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY 가 .env.local 에 올바르게 설정되지 않았습니다.');
  process.exit(1);
}

const supabase = createClient(url, key, {
  auth: { persistSession: false, autoRefreshToken: false },
});

/**
 * 시드 정의
 * @type {Array<{file: string, title: string, category: string | null}>}
 */
const SEEDS = [
  // 음식
  { file: 'apple.svg', title: '사과', category: '음식' },
  { file: 'cake.svg', title: '케이크', category: '음식' },
  { file: 'pizza.svg', title: '피자', category: '음식' },
  { file: 'icecream.svg', title: '아이스크림', category: '음식' },
  // 탈것
  { file: 'balloon.svg', title: '풍선', category: '탈것' },
  { file: 'car.svg', title: '자동차', category: '탈것' },
  { file: 'airplane.svg', title: '비행기', category: '탈것' },
  { file: 'boat.svg', title: '배', category: '탈것' },
  // 동물
  { file: 'dog.svg', title: '강아지', category: '동물' },
  { file: 'cat.svg', title: '고양이', category: '동물' },
  { file: 'rabbit.svg', title: '토끼', category: '동물' },
  // 공룡
  { file: 'trex.svg', title: '티라노', category: '공룡' },
  { file: 'brachio.svg', title: '브라키오', category: '공룡' },
  { file: 'triceratops.svg', title: '트리케라톱스', category: '공룡' },
];

const ROOT = join(import.meta.dirname, '..');

async function main() {
  console.log(`→ Supabase: ${url}`);

  // 카테고리 이름 → id 맵
  const { data: cats, error: catErr } = await supabase.from('categories').select('id, name');
  if (catErr) throw catErr;
  if (!cats || cats.length === 0) {
    throw new Error('categories 테이블이 비어있습니다. 마이그레이션이 적용됐는지 확인하세요.');
  }
  const catByName = new Map(cats.map((c) => [c.name, c.id]));
  console.log(`  카테고리 ${cats.length}개 로드됨`);

  let added = 0;
  let updated = 0;
  let skipped = 0;

  for (const seed of SEEDS) {
    const storagePath = `system/${seed.file}`;

    // SVG 파일 읽기 + Storage 업로드 (upsert — 항상 최신 SVG 반영)
    const svgBytes = await readFile(join(ROOT, 'seed', 'outlines', seed.file));
    const { error: upErr } = await supabase.storage.from('outlines').upload(storagePath, svgBytes, {
      contentType: 'image/svg+xml',
      upsert: true,
    });
    if (upErr) throw upErr;

    // DB row 존재 여부 확인
    const { data: existing, error: selErr } = await supabase
      .from('coloring_pages')
      .select('id, title, category_id')
      .eq('outline_path', storagePath)
      .maybeSingle();
    if (selErr) throw selErr;

    const categoryId = seed.category ? (catByName.get(seed.category) ?? null) : null;

    if (existing) {
      // 메타가 같으면 스킵, 다르면 update
      if (existing.title === seed.title && existing.category_id === categoryId) {
        console.log(`  ✓ ${seed.title}: 변경 없음 (${existing.id})`);
        skipped++;
        continue;
      }
      const { error: updErr } = await supabase
        .from('coloring_pages')
        .update({ title: seed.title, category_id: categoryId })
        .eq('id', existing.id);
      if (updErr) throw updErr;
      console.log(`  ~ ${seed.title} → ${existing.id}  [category: ${seed.category ?? 'none'}] (updated)`);
      updated++;
      continue;
    }

    // 신규 insert
    const { data: page, error: insErr } = await supabase
      .from('coloring_pages')
      .insert({
        title: seed.title,
        category_id: categoryId,
        outline_path: storagePath,
        source: 'default',
      })
      .select('id')
      .single();
    if (insErr) throw insErr;

    console.log(`  + ${seed.title} → ${page.id}  [category: ${seed.category ?? 'none'}] (inserted)`);
    added++;
  }

  console.log(`\ndone — 추가 ${added}개, 갱신 ${updated}개, 스킵 ${skipped}개`);
}

main().catch((err) => {
  console.error('\n❌ seed failed:', err.message ?? err);
  if (err.details) console.error('   details:', err.details);
  if (err.hint) console.error('   hint:', err.hint);
  process.exit(1);
});
