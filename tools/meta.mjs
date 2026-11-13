#!/usr/bin/env node
// Генерирует *.meta.js (только заголовок скрипта — по нему Tampermonkey проверяет обновления,
// не скачивая весь файл) и проверяет заголовки на типичные ошибки.
// Generates *.meta.js (header only — Tampermonkey checks updates against it without
// downloading the whole script) and validates headers for common mistakes.
//
//   node tools/meta.mjs          — пересобрать .meta.js / rebuild .meta.js
//   node tools/meta.mjs --check  — только проверить (для CI) / check only (for CI)

import { readFile, writeFile, readdir } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const SCRIPTS_DIR = path.join(ROOT, 'scripts');
const RAW_BASE = 'https://raw.githubusercontent.com/Rolarn/Tamper-scripts/main/scripts';
const REQUIRED = ['name', 'namespace', 'version', 'description', 'author', 'license', 'match',
  'grant', 'updateURL', 'downloadURL', 'homepageURL', 'supportURL'];
const SEMVER = /^\d+\.\d+\.\d+$/;

const checkOnly = process.argv.includes('--check');
const problems = [];

function parseHeader(source, file) {
  const m = source.match(/^\/\/ ==UserScript==\n[\s\S]*?\n\/\/ ==\/UserScript==\n/);
  if (!m) {
    problems.push(`${file}: заголовок ==UserScript== не найден / header not found`);
    return null;
  }
  const keys = new Map();
  for (const line of m[0].split('\n')) {
    const kv = line.match(/^\/\/ @(\S+)(?:\s+(.*))?$/);
    if (!kv) continue;
    if (!keys.has(kv[1])) keys.set(kv[1], []);
    keys.get(kv[1]).push((kv[2] || '').trim());
  }
  return { block: m[0], keys };
}

const dirs = (await readdir(SCRIPTS_DIR, { withFileTypes: true })).filter((d) => d.isDirectory());

for (const dir of dirs) {
  const id = dir.name;
  const base = path.join(SCRIPTS_DIR, id);
  const userFile = path.join(base, `${id}.user.js`);
  const metaFile = path.join(base, `${id}.meta.js`);
  const rel = (f) => path.relative(ROOT, f);

  if (!existsSync(userFile)) {
    problems.push(`${rel(base)}: нет ${id}.user.js / missing ${id}.user.js`);
    continue;
  }
  const header = parseHeader(await readFile(userFile, 'utf8'), rel(userFile));
  if (!header) continue;
  const { block, keys } = header;
  const one = (k) => keys.get(k)?.[0] ?? '';

  for (const k of REQUIRED) {
    if (!keys.has(k)) problems.push(`${rel(userFile)}: нет @${k} / missing @${k}`);
  }
  const version = one('version');
  if (version && !SEMVER.test(version)) problems.push(`${rel(userFile)}: @version "${version}" не SemVer / is not SemVer`);
  const wantUpdate = `${RAW_BASE}/${id}/${id}.meta.js`;
  const wantDownload = `${RAW_BASE}/${id}/${id}.user.js`;
  if (keys.has('updateURL') && one('updateURL') !== wantUpdate) problems.push(`${rel(userFile)}: @updateURL должен быть / must be ${wantUpdate}`);
  if (keys.has('downloadURL') && one('downloadURL') !== wantDownload) problems.push(`${rel(userFile)}: @downloadURL должен быть / must be ${wantDownload}`);

  // Каждая версия должна быть описана в CHANGELOG.md. / Every version must be in CHANGELOG.md.
  const changelog = path.join(base, 'CHANGELOG.md');
  if (!existsSync(changelog)) {
    problems.push(`${rel(base)}: нет CHANGELOG.md / missing CHANGELOG.md`);
  } else if (version && !(await readFile(changelog, 'utf8')).includes(`## [${version}]`)) {
    problems.push(`${rel(changelog)}: нет записи для версии / no entry for version ${version}`);
  }
  if (!existsSync(path.join(base, 'README.md'))) problems.push(`${rel(base)}: нет README.md / missing README.md`);

  // .meta.js
  const current = existsSync(metaFile) ? await readFile(metaFile, 'utf8') : null;
  if (current !== block) {
    if (checkOnly) problems.push(`${rel(metaFile)}: устарел — запустите npm run meta / outdated — run npm run meta`);
    else {
      await writeFile(metaFile, block);
      console.log(`обновлён / updated: ${rel(metaFile)}`);
    }
  }
}

if (problems.length) {
  console.error(problems.map((p) => '✗ ' + p).join('\n'));
  process.exit(1);
}
console.log(`✓ ${dirs.length} скрипт(а) в порядке / script(s) OK`);
