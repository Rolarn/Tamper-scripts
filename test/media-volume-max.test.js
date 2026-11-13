import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { JSDOM } from 'jsdom';

const SRC = await readFile(new URL('../scripts/media-volume-max/media-volume-max.user.js', import.meta.url), 'utf8');
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

function page(url = 'https://example.com/', { stored, src = SRC } = {}) {
  const dom = new JSDOM('<!doctype html><html><head></head><body><video id="v"></video></body></html>',
    { url, runScripts: 'outside-only' });
  const w = dom.window;
  if (stored !== undefined) w.localStorage.setItem('volume', stored);
  const native = Object.getOwnPropertyDescriptor(w.HTMLMediaElement.prototype, 'volume');
  w.eval(src);
  return { w, v: w.document.getElementById('v'), native };
}

test('KVS: сохранённые 0.3 становятся 1 / stored 0.3 becomes 1', () => {
  const { w } = page('https://g.porno666.fo/video/1/', { stored: '0.3' });
  assert.equal(w.localStorage.getItem('volume'), '1');
});

test('KVS: 0 и чужие значения не трогаем / 0 and foreign values are kept', () => {
  assert.equal(page('https://a.example/', { stored: '0' }).w.localStorage.getItem('volume'), '0');
  assert.equal(page('https://b.example/', { stored: '75' }).w.localStorage.getItem('volume'), '75');
});

test('KVS: на обычном сайте ключ не создаём / no key created on regular sites', () => {
  assert.equal(page('https://c.example/').w.localStorage.getItem('volume'), null);
});

test('KVS: первый заход — 1 записана до запуска плеера / first visit — 1 written before the player', async () => {
  const { w } = page('https://new-kvs.example/');
  const s = w.document.createElement('script');
  s.src = 'https://new-kvs.example/player/kt_player.js?v=1';
  w.document.head.appendChild(s);
  await sleep(20);
  assert.equal(w.localStorage.getItem('volume'), '1');
});

test('Плееры: 0.3 → 1, 0 и muted не трогаем / players: 0.3 → 1, 0 and muted kept', () => {
  const { v } = page();
  v.volume = 0.3;
  assert.equal(v.volume, 1);
  v.volume = 0;
  assert.equal(v.volume, 0);
  v.volume = 0.5;
  assert.equal(v.volume, 1);
  v.muted = true;
  v.volume = 0.4;
  assert.equal(v.muted, true);
});

test('Запасной способ и защита от «перетягивания» / fallback and tug-of-war guard', () => {
  const { w, v, native } = page();
  native.set.call(v, 0.3); // громкость поставлена в обход подмены / set bypassing the patch
  v.dispatchEvent(new w.Event('play'));
  assert.equal(v.volume, 1);
  let events = 0;
  v.addEventListener('volumechange', () => { events++; if (events < 50) native.set.call(v, 0.3); });
  for (let i = 0; i < 30; i++) v.dispatchEvent(new w.Event('volumechange'));
  assert.ok(events <= 30);
});

test('Исключённый сайт не трогаем / excluded site is left alone', () => {
  const src = SRC.replace('const EXCLUDE = [];', "const EXCLUDE = ['example.com'];");
  const { v, w } = page('https://www.example.com/', { stored: '0.3', src });
  v.volume = 0.3;
  assert.ok(Math.abs(v.volume - 0.3) < 1e-9);
  assert.equal(w.localStorage.getItem('volume'), '0.3');
});
