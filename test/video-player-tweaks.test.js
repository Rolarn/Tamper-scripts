import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { JSDOM } from 'jsdom';

const SRC = await readFile(new URL('../scripts/video-player-tweaks/video-player-tweaks.user.js', import.meta.url), 'utf8');
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
  const { w } = page('https://videos.example/video/1/', { stored: '0.3' });
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

// ---------- Перемотка двойным тапом / Double-tap seek ----------

function seekPage(url = 'https://videos.example/v/1', src = SRC) {
  const { w, v } = page(url, { src });
  // Видео 400×200 в углу экрана, 100 с, играет. / A 400×200 video at the corner, 100 s, playing.
  v.getBoundingClientRect = () => ({ left: 0, top: 0, right: 400, bottom: 200, width: 400, height: 200 });
  let paused = false;
  Object.defineProperty(v, 'duration', { value: 100 });
  Object.defineProperty(v, 'currentTime', { value: 50, writable: true });
  Object.defineProperty(v, 'paused', { get: () => paused });
  v.play = () => { paused = false; return Promise.resolve(); };
  v.pause = () => { paused = true; };
  // Плеер сайта: тап по видео — пауза/пуск. / Site player: a tap toggles play/pause.
  const player = { clicks: 0 };
  v.addEventListener('click', () => { player.clicks++; paused = !paused; });

  const touch = (type, x, y, target) => {
    const e = new w.Event(type, { bubbles: true, cancelable: true });
    const list = [{ clientX: x, clientY: y }];
    Object.defineProperty(e, 'touches', { value: type === 'touchstart' ? list : [] });
    Object.defineProperty(e, 'changedTouches', { value: list });
    target.dispatchEvent(e);
    return e;
  };
  // Тап как в браузере: клик приходит, только если touchend не отменён.
  // A browser-like tap: the click arrives only if touchend was not cancelled.
  const tap = (x, y, target = v) => {
    touch('touchstart', x, y, target);
    const end = touch('touchend', x, y, target);
    if (!end.defaultPrevented) target.dispatchEvent(new w.MouseEvent('click', { bubbles: true, cancelable: true, clientX: x, clientY: y }));
  };
  return { w, v, tap, player, isPaused: () => paused };
}

test('Двойной тап справа: +10 с, воспроизведение не прерывается / right double tap: +10 s, playback kept', async () => {
  const { v, tap, isPaused } = seekPage();
  tap(350, 100);
  await sleep(50);
  tap(350, 100);
  await sleep(120);
  assert.equal(v.currentTime, 60);
  assert.equal(isPaused(), false, 'пауза от первого тапа отменена / first-tap pause undone');
});

test('Серия тапов слева накапливает: 10 → 20 → 30 / left tap series accumulates', async () => {
  const { v, tap, player } = seekPage();
  tap(40, 100);
  await sleep(50);
  tap(40, 100);
  await sleep(50);
  tap(40, 100);
  await sleep(50);
  tap(40, 100);
  await sleep(120);
  assert.equal(v.currentTime, 20);
  assert.equal(player.clicks, 1, 'плеер видел только первый тап / player saw only the first tap');
});

test('Центр, панель управления и одиночные тапы не трогаем / centre, control bar and single taps are untouched', async () => {
  const { v, tap, player } = seekPage();
  tap(200, 100); await sleep(50); tap(200, 100); // центр / centre
  await sleep(400);
  tap(350, 190); await sleep(50); tap(350, 190); // панель снизу / bottom bar
  await sleep(400);
  tap(350, 100); await sleep(400); tap(350, 100); // слишком медленно / too slow
  await sleep(100);
  assert.equal(v.currentTime, 50);
  assert.equal(player.clicks, 6);
});

test('Не выходит за начало и конец видео / clamped to the video bounds', async () => {
  const { v, tap } = seekPage();
  v.currentTime = 5;
  tap(40, 100); await sleep(50); tap(40, 100);
  await sleep(120);
  assert.equal(v.currentTime, 0);
});

test('Кнопки плеера не перехватываем / player buttons are not intercepted', async () => {
  const { w, v, tap } = seekPage();
  const btn = w.document.createElement('button');
  w.document.body.appendChild(btn);
  tap(350, 100, btn); await sleep(50); tap(350, 100, btn);
  await sleep(120);
  assert.equal(v.currentTime, 50);
});

test('На сайтах из SEEK_EXCLUDE перемотки нет / no seek on SEEK_EXCLUDE sites', async () => {
  const { v, tap } = seekPage('https://m.youtube.com/watch?v=x');
  tap(350, 100); await sleep(50); tap(350, 100);
  await sleep(120);
  assert.equal(v.currentTime, 50);
});
