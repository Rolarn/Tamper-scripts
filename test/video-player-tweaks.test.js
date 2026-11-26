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
  // Как в браузере: play/pause шлют события. / Like a browser: play/pause fire events.
  v.play = () => { if (paused) { paused = false; v.dispatchEvent(new w.Event('play')); } return Promise.resolve(); };
  v.pause = () => { if (!paused) { paused = true; v.dispatchEvent(new w.Event('pause')); } };
  const toggle = () => (paused ? v.play() : v.pause());
  // Плеер сайта: тап по видео — пауза/пуск; режим настраивается тестом.
  // Site player: a tap toggles play/pause; the mode is set by the test.
  const player = { clicks: 0, mode: 'click', delay: 0 };
  v.addEventListener('click', () => {
    player.clicks++;
    if (player.mode !== 'click') return;
    if (player.delay) setTimeout(toggle, player.delay); else toggle();
  });
  v.addEventListener('pointerdown', () => { if (player.mode === 'pointerdown') toggle(); });

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
    const pd = new w.Event('pointerdown', { bubbles: true, cancelable: true });
    Object.assign(pd, { pointerType: 'touch', clientX: x, clientY: y });
    target.dispatchEvent(pd);
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

// ---------- Свайпы яркости и громкости / Brightness and volume swipes ----------

function swipePage() {
  const p = seekPage();
  const { w, v } = p;
  let fs = null;
  Object.defineProperty(w.document, 'fullscreenElement', { get: () => fs, configurable: true });
  p.enterFullscreen = () => { fs = w.document.body; w.document.dispatchEvent(new w.Event('fullscreenchange')); };
  p.exitFullscreen = () => { fs = null; w.document.dispatchEvent(new w.Event('fullscreenchange')); };
  const touch = (type, x, y) => {
    const e = new w.Event(type, { bubbles: true, cancelable: true });
    const list = [{ clientX: x, clientY: y }];
    Object.defineProperty(e, 'touches', { value: type === 'touchend' ? [] : list });
    Object.defineProperty(e, 'changedTouches', { value: list });
    v.dispatchEvent(e);
    return e;
  };
  // Свайп по вертикали шагами, как настоящий палец. / A vertical swipe in steps, like a real finger.
  p.swipe = (x, y0, y1) => {
    touch('touchstart', x, y0);
    const steps = 8;
    let moved = null;
    for (let i = 1; i <= steps; i++) moved = touch('touchmove', x, y0 + ((y1 - y0) * i) / steps);
    touch('touchend', x, y1);
    return moved;
  };
  return p;
}

test('Свайп вне полного экрана ничего не меняет и не мешает прокрутке / no effect outside fullscreen', () => {
  const { v, swipe } = swipePage();
  v.volume = 1;
  const last = swipe(350, 130, 50);
  assert.equal(last.defaultPrevented, false);
  assert.equal(v.volume, 1);
  assert.equal(v.style.filter, '');
});

test('Правая половина: громкость вниз и вверх, «громкость 100%» не мешает / right half: volume down and up', () => {
  const { v, swipe, enterFullscreen } = swipePage();
  enterFullscreen();
  const last = swipe(350, 50, 130); // вниз на 80 px из 200 при чувствительности 0.8 → −50%
  assert.equal(last.defaultPrevented, true);
  assert.ok(Math.abs(v.volume - 0.5) < 0.01, 'volume ' + v.volume);
  swipe(350, 140, 100); // вверх на 40 px → +25%
  assert.ok(Math.abs(v.volume - 0.75) < 0.01, 'volume ' + v.volume);
  v.dispatchEvent(new v.ownerDocument.defaultView.Event('play'));
  assert.ok(Math.abs(v.volume - 0.75) < 0.01, 'запасной способ не вернул 100% / fallback did not reset to 100%');
});

test('Левая половина: яркость через фильтр, 100% — без фильтра / left half: brightness filter', () => {
  const { v, swipe, enterFullscreen } = swipePage();
  enterFullscreen();
  swipe(50, 50, 130); // −50%
  assert.match(v.style.filter, /^brightness\(0\.50?\)$/);
  swipe(50, 130, 50); // +50% → снова 100%
  assert.equal(v.style.filter, '');
  swipe(50, 140, 10); // много вверх → упор в 150%
  assert.match(v.style.filter, /^brightness\(1\.50?\)$/);
});

test('Выход из полного экрана выключает вертикальные свайпы / leaving fullscreen disables vertical swipes', () => {
  const { v, swipe, enterFullscreen, exitFullscreen } = swipePage();
  enterFullscreen();
  exitFullscreen();
  v.volume = 1;
  assert.equal(swipe(350, 50, 130).defaultPrevented, false);
  assert.equal(v.volume, 1);
});

// ---------- Перемотка горизонтальным свайпом (2.2.0) / Horizontal swipe seek (2.2.0) ----------

function hswipe(p, x0, x1, y = 100, dy = 0) {
  const { w, v } = p;
  const touch = (type, x, yy) => {
    const e = new w.Event(type, { bubbles: true, cancelable: true });
    const list = [{ clientX: x, clientY: yy }];
    Object.defineProperty(e, 'touches', { value: type === 'touchend' ? [] : list });
    Object.defineProperty(e, 'changedTouches', { value: list });
    v.dispatchEvent(e);
    return e;
  };
  touch('touchstart', x0, y);
  const steps = 8;
  const timeDuring = [];
  for (let i = 1; i <= steps; i++) {
    touch('touchmove', x0 + ((x1 - x0) * i) / steps, y + (dy * i) / steps);
    timeDuring.push(v.currentTime);
  }
  touch('touchend', x1, y + dy);
  return { timeDuring };
}

test('Обычный режим: свайп вправо перематывает при отпускании / inline: swipe right seeks on release', () => {
  const p = swipePage();
  const { timeDuring } = hswipe(p, 100, 300); // 200 px из 400 → половина от 120 с = +60 с
  assert.ok(timeDuring.every((t) => t === 50), 'во время свайпа видео не дёргаем / no seeking while swiping');
  assert.equal(p.v.currentTime, 99.5, 'упор в конец видео / clamped to the end');
});

test('Полный экран: свайп влево назад, подсказка с временем / fullscreen: swipe left back, time hint', () => {
  const p = swipePage();
  p.enterFullscreen();
  hswipe(p, 300, 200); // −100 px → −30 с
  assert.equal(p.v.currentTime, 20);
  const hud = [...p.w.document.body.children].find((el) => el.style.position === 'fixed');
  assert.match(hud.textContent, /^−0:30 · 0:20 \/ 1:40$/);
});

test('Косой свайп и маленькое движение не перематывают / diagonal swipe and tiny moves do not seek', () => {
  const p = swipePage();
  hswipe(p, 100, 180, 100, 60); // по диагонали / diagonal
  assert.equal(p.v.currentTime, 50);
  hswipe(p, 200, 205); // меньше порога / below the threshold
  assert.equal(p.v.currentTime, 50);
});

test('Свайп по панели плеера оставляем плееру / swipes on the control bar stay with the player', () => {
  const p = swipePage();
  hswipe(p, 100, 300, 190);
  assert.equal(p.v.currentTime, 50);
});

// ---------- Двойной тап не ставит на паузу (2.1.1) / Double tap does not pause (2.1.1) ----------

test('Плеер с отложенной паузой: двойной тап не ставит на паузу / delayed-toggle player: no pause', async () => {
  const { v, tap, player, isPaused } = seekPage();
  player.delay = 300; // плеер ждёт, не двойной ли это тап / the player waits for a possible double tap
  tap(350, 100);
  await sleep(80);
  tap(350, 100);
  await sleep(900);
  assert.equal(v.currentTime, 60);
  assert.equal(isPaused(), false);
});

test('Плеер реагирует на касание: серия из 4 тапов не меняет паузу / pointerdown player: 4-tap series keeps state', async () => {
  const { v, tap, player, isPaused } = seekPage();
  player.mode = 'pointerdown';
  for (let i = 0; i < 4; i++) { tap(40, 100); await sleep(80); }
  await sleep(300);
  assert.equal(v.currentTime, 20);
  assert.equal(isPaused(), false);
});

test('На паузе: двойной тап не запускает видео / paused video stays paused', async () => {
  const { v, tap, player, isPaused } = seekPage();
  v.pause();
  player.delay = 250;
  tap(350, 100);
  await sleep(80);
  tap(350, 100);
  await sleep(900);
  assert.equal(v.currentTime, 60);
  assert.equal(isPaused(), true);
});

test('Тап по центру сразу после серии ставит паузу как обычно / centre tap right after a series pauses normally', async () => {
  const { tap, isPaused } = seekPage();
  tap(350, 100);
  await sleep(80);
  tap(350, 100);
  await sleep(200);
  tap(200, 100); // пауза по центру, пока охрана ещё активна / centre pause while the guard is active
  await sleep(200);
  assert.equal(isPaused(), true);
});

test('Серия продолжается до 1 с между тапами / series continues up to 1 s between taps', async () => {
  const { v, tap } = seekPage();
  tap(350, 100);
  await sleep(80);
  tap(350, 100);
  await sleep(850);
  tap(350, 100);
  await sleep(100);
  assert.equal(v.currentTime, 70);
});

// ---------- Кнопка «Открыть в MX Player» (2.3.0) / "Open in MX Player" button (2.3.0) ----------

function mxPage(src, scriptSrc = SRC) {
  const p = seekPage('https://videos.example/v/1', scriptSrc);
  const { w, v } = p;
  if (src) v.src = src;
  w.document.title = 'Видео: тест';
  p.links = [];
  w.HTMLAnchorElement.prototype.click = function () { p.links.push({ href: this.href, target: this.target }); };
  p.touchVideo = () => {
    const e = new w.Event('touchstart', { bubbles: true, cancelable: true });
    const list = [{ clientX: 200, clientY: 100 }];
    Object.defineProperty(e, 'touches', { value: list });
    Object.defineProperty(e, 'changedTouches', { value: list });
    v.dispatchEvent(e);
  };
  p.mxButton = () => [...w.document.body.querySelectorAll('button')].find((b) => b.textContent === '▶ MX');
  return p;
}

test('MX: касание видео показывает кнопку, тап открывает MX с позиции / touch shows button, tap opens MX at position', () => {
  const p = mxPage('https://cdn.example/files/clip.mp4?token=abc&e=1#t=5');
  p.touchVideo();
  const btn = p.mxButton();
  assert.ok(btn);
  assert.equal(btn.style.display, 'block');
  assert.equal(btn.style.left, '200px', 'по центру видео / centred over the video');
  btn.click();
  assert.equal(p.links.length, 1);
  const { href, target } = p.links[0];
  assert.equal(target, '_top');
  assert.ok(href.startsWith('intent://cdn.example/files/clip.mp4?token=abc&e=1#Intent;'), href);
  for (const part of ['action=android.intent.action.VIEW', 'scheme=https', 'type=video/*',
    'package=com.mxtech.videoplayer.ad', 'i.position=50000', 'S.title=' + encodeURIComponent('Видео: тест')]) {
    assert.ok(href.includes(';' + part), 'нет / missing ' + part);
  }
  assert.ok(href.endsWith(';end'));
  assert.equal(p.isPaused(), true, 'видео в браузере на паузе / browser video paused');
  assert.equal(btn.style.display, 'none');
});

test('MX: HLS-поток передаётся с типом application/x-mpegURL / HLS stream gets the HLS type', () => {
  const p = mxPage('https://cdn.example/live/index.m3u8');
  p.touchVideo();
  p.mxButton().click();
  assert.ok(p.links[0].href.includes(';type=application/x-mpegURL;'));
});

test('MX: для blob: кнопки нет / no button for blob: videos', () => {
  const p = mxPage('blob:https://videos.example/123');
  p.touchVideo();
  assert.equal(p.mxButton(), undefined);
});

test('MX: кнопка прячется сама и при прокрутке / button hides by itself and on scroll', async () => {
  const p = mxPage('https://cdn.example/a.mp4', SRC.replace('const MX_BUTTON_MS = 10000;', 'const MX_BUTTON_MS = 150;'));
  p.touchVideo();
  assert.equal(p.mxButton().style.display, 'block');
  await sleep(250);
  assert.equal(p.mxButton().style.display, 'none');
  p.touchVideo();
  p.w.dispatchEvent(new p.w.Event('scroll'));
  assert.equal(p.mxButton().style.display, 'none');
});

test('MX: тап по кнопке не перематывает и не ставит паузу через плеер / button tap is not a player tap', async () => {
  const p = mxPage('https://cdn.example/a.mp4');
  p.touchVideo();
  const btn = p.mxButton();
  const tapBtn = () => {
    const pd = new p.w.Event('pointerdown', { bubbles: true, cancelable: true });
    Object.assign(pd, { pointerType: 'touch', clientX: 200, clientY: 20 });
    btn.dispatchEvent(pd);
  };
  tapBtn();
  assert.equal(p.player.clicks, 0);
  assert.equal(p.v.currentTime, 50);
});

// ---------- MX для видео blob: (2.4.0) / MX for blob: videos (2.4.0) ----------

function addLinks(w, list) {
  for (const [href, text] of list) {
    const a = w.document.createElement('a');
    a.href = href;
    a.textContent = text;
    w.document.body.appendChild(a);
  }
}

test('MX + blob: берётся лучшая ссылка на скачивание не выше 1080p / best download link up to 1080p', () => {
  const p = mxPage('blob:https://videos.example/123');
  addLinks(p.w, [
    ['https://videos.example/dload/abc/240/111-240p.mp4', 'Download MP4 (240p)'],
    ['https://videos.example/dload/abc/720/111-720p.mp4', 'Download MP4 (720p HD)'],
    ['https://videos.example/dload/abc/1080/111-1080p.mp4', 'Download MP4 (1080p HD)'],
    ['https://videos.example/dload/abc/2160/111-2160p.mp4', 'Download MP4 (4K)'],
    ['https://videos.example/other.mp4', 'Другое видео без качества'],
  ]);
  p.touchVideo();
  p.mxButton().click();
  assert.ok(p.links[0].href.startsWith('intent://videos.example/dload/abc/1080/111-1080p.mp4#Intent;'), p.links[0].href);
  assert.ok(p.links[0].href.includes(';type=video/*;'));
});

test('MX + blob: предел качества настраивается / quality cap is configurable', () => {
  const p = mxPage('blob:https://videos.example/123', SRC.replace('const MX_MAX_HEIGHT = 1080;', 'const MX_MAX_HEIGHT = 720;'));
  addLinks(p.w, [
    ['https://videos.example/dload/abc/720/111-720p.mp4', '720p'],
    ['https://videos.example/dload/abc/1080/111-1080p.mp4', '1080p'],
  ]);
  p.touchVideo();
  p.mxButton().click();
  assert.ok(p.links[0].href.includes('/dload/abc/720/111-720p.mp4#Intent;'));
});

test('MX + blob: без ссылок берётся загруженный поток .m3u8 / falls back to a loaded .m3u8', () => {
  const p = mxPage('blob:https://videos.example/123');
  p.w.performance.getEntriesByType = (type) => (type === 'resource'
    ? [{ name: 'https://cdn.example/js/app.js' }, { name: 'https://cdn.example/hls/abc/master.m3u8?t=1' },
      { name: 'https://cdn.example/hls/abc/720/index.m3u8' }]
    : []);
  p.touchVideo();
  p.mxButton().click();
  assert.ok(p.links[0].href.startsWith('intent://cdn.example/hls/abc/master.m3u8?t=1#Intent;'), p.links[0].href);
  assert.ok(p.links[0].href.includes(';type=application/x-mpegURL;'));
});

// ---------- Без автозапуска и со звуком (2.5.0) / No autoplay, sound on (2.5.0) ----------

// jsdom не умеет создавать «настоящие» события пользователя — в тестах проверку isTrusted снимаем.
// jsdom cannot create trusted user events, so the isTrusted check is lifted for these tests.
const TRUSTING_SRC = SRC.replaceAll('e.isTrusted', 'true');

function reactorPage(url = 'https://reactor.cc/post/6416883') {
  const p = seekPage(url, TRUSTING_SRC);
  const { w } = p;
  p.gesture = (type, x = 200, y = 100) => {
    const e = new w.Event(type, { bubbles: true, cancelable: true });
    Object.assign(e, { clientX: x, clientY: y });
    w.document.body.dispatchEvent(e);
  };
  p.newVideo = () => {
    const box = w.document.createElement('div');
    box.innerHTML = '<video autoplay muted loop src="https://img1.reactor.cc/pics/post/webm/x.webm"></video>';
    w.document.body.appendChild(box);
    return box.firstElementChild;
  };
  return p;
}

test('Reactor: новое видео без autoplay и со звуком / new video: no autoplay, unmuted', async () => {
  const p = reactorPage();
  const nv = p.newVideo();
  await sleep(10);
  assert.equal(nv.autoplay, false);
  assert.equal(nv.hasAttribute('autoplay'), false);
  assert.equal(nv.muted, false);
  assert.equal(nv.hasAttribute('muted'), false);
  assert.equal(nv.preload, 'metadata');
});

test('Reactor: запуск скриптом сайта ставится на паузу / site-initiated start is paused', async () => {
  const p = reactorPage();
  p.v.pause();
  await sleep(1100); // нет недавних действий пользователя / no recent user action
  p.v.play();
  assert.equal(p.isPaused(), true);
});

test('Reactor: запуск по тапу пользователя работает / start on user tap works', () => {
  const p = reactorPage();
  p.v.pause();
  p.gesture('click');
  p.v.play();
  assert.equal(p.isPaused(), false);
});

test('Reactor: нажатие пальца на видео разрешает, вне видео — нет / pointerdown counts only on a video', async () => {
  const p = reactorPage();
  p.v.pause();
  await sleep(1100);
  p.gesture('pointerdown', 500, 500); // вне видео (начало прокрутки) / outside the video (scroll start)
  p.v.play();
  assert.equal(p.isPaused(), true);
  p.gesture('pointerdown', 200, 100); // на видео / on the video
  p.v.play();
  assert.equal(p.isPaused(), false);
});

test('Reactor: сайт снова выключил звук — включаем; выключение пользователем оставляем / site mute undone, user mute kept', async () => {
  const p = reactorPage();
  await sleep(1100);
  const mute = () => { p.v.muted = true; p.v.dispatchEvent(new p.w.Event('volumechange')); };
  mute(); // сайт / the site
  assert.equal(p.v.muted, false);
  p.gesture('click');
  mute(); // пользователь кнопкой / the user via a button
  assert.equal(p.v.muted, true);
});

test('Другие сайты не затрагиваются / other sites are not affected', async () => {
  const p = reactorPage('https://videos.example/v/1');
  const nv = p.newVideo();
  await sleep(10);
  assert.equal(nv.hasAttribute('autoplay'), true);
  assert.equal(nv.hasAttribute('muted'), true);
  p.v.pause();
  await sleep(1100);
  p.v.play();
  assert.equal(p.isPaused(), false);
});
