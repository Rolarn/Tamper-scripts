// ==UserScript==
// @name            Video players: volume 100% & double-tap seek
// @name:ru         Видеоплееры: громкость 100% и перемотка двойным тапом
// @namespace       https://github.com/Rolarn/Tamper-scripts
// @version         2.1.0
// @description     Stops websites from lowering video/audio volume and adds touch gestures to any HTML5 video: YouTube-style double-tap seek and MX Player-style swipes for brightness and volume.
// @description:ru  Не даёт сайтам занижать громкость и добавляет любому HTML5-видео жесты: перемотку двойным тапом, как в YouTube, и свайпы яркости и громкости, как в MX Player.
// @author          Rolarn
// @license         MIT
// @homepageURL     https://github.com/Rolarn/Tamper-scripts/tree/main/scripts/video-player-tweaks
// @homepage        https://github.com/Rolarn/Tamper-scripts/tree/main/scripts/video-player-tweaks
// @supportURL      https://github.com/Rolarn/Tamper-scripts/issues
// @updateURL       https://raw.githubusercontent.com/Rolarn/Tamper-scripts/main/scripts/video-player-tweaks/video-player-tweaks.meta.js
// @downloadURL     https://raw.githubusercontent.com/Rolarn/Tamper-scripts/main/scripts/video-player-tweaks/video-player-tweaks.user.js
// @match           *://*/*
// @grant           none
// @run-at          document-start
// ==/UserScript==

(() => {
  'use strict';

  // ================= НАСТРОЙКИ / SETTINGS =================
  // Сайты, где скрипт не нужен вообще (часть адреса сайта), например ['vk.com'].
  // Sites to skip entirely (part of the host name), e.g. ['vk.com'].
  const EXCLUDE = [];

  // --- Громкость 100% / Volume 100% ---
  const VOLUME_ENABLED = true;

  // --- Перемотка двойным тапом / Double-tap seek ---
  const SEEK_ENABLED = true;
  // Шаг перемотки, секунд. Каждый следующий тап в серии добавляет ещё столько же (10 → 20 → 30…).
  // Seek step, seconds. Every further tap in a series adds the same again (10 → 20 → 30…).
  const SEEK_STEP = 10;
  // Сайты со своей перемоткой двойным тапом — там наша не нужна.
  // Sites with their own double-tap seek — ours is not needed there.
  const SEEK_EXCLUDE = ['youtube.com'];
  // Только в полноэкранном режиме (надёжнее на сайтах с необычными плеерами).
  // Only in fullscreen (safer on sites with unusual players).
  const SEEK_FULLSCREEN_ONLY = false;

  // --- Свайпы яркости и громкости, как в MX Player / MX Player-style swipes ---
  // Вертикальный свайп: левая половина видео — яркость, правая — громкость.
  // Vertical swipe: left half of the video = brightness, right half = volume.
  const SWIPE_ENABLED = true;
  // Только в полноэкранном режиме. Вне его вертикальный свайп прокручивает страницу —
  // если выключить, свайп по видео перестанет её прокручивать.
  // Fullscreen only. Outside fullscreen a vertical swipe scrolls the page — turning this off
  // makes swipes over a video stop scrolling the page.
  const SWIPE_FULLSCREEN_ONLY = true;
  // Сколько высоты видео нужно провести для изменения на 100%. / Swipe length (in video heights) for a 100% change.
  const SWIPE_SENSITIVITY = 0.8;
  // Пределы яркости: 0.1 = 10%, 1.5 = 150%. / Brightness limits.
  const BRIGHTNESS_MIN = 0.1;
  const BRIGHTNESS_MAX = 1.5;
  // =========================================================

  const host = location.hostname;
  const hostMatches = (list) => list.some((part) => host.includes(part));
  if (hostMatches(EXCLUDE)) return;

  // Видео, громкость которых пользователь выставил жестом: «громкость 100%» их не трогает.
  // Videos whose volume the user set by gesture: "volume 100%" leaves them alone.
  const userVolume = new WeakSet();


  // =========================================================
  // Громкость 100% / Volume 100%
  // =========================================================
  function setupVolume() {
    // 1) Плееры KVS (kt_player) — главный способ. Плеер берёт громкость из хранилища сайта
    //    (localStorage "volume") и по ней рисует иконку; в мобильной версии ползунка нет, и там
    //    навсегда застревает, например, 0.3. Хранилище доступно в любом режиме Tampermonkey.
    //    KVS players — main path. The player reads its volume from site storage and draws the
    //    icon from it; mobile layouts have no slider, so 0.3 sticks forever.
    const STORAGE_KEY = 'volume';
    const isFraction = (v) => v !== null && Number(v) > 0 && Number(v) < 1;

    const raiseStoredVolume = (createIfMissing) => {
      try {
        const v = localStorage.getItem(STORAGE_KEY);
        if (isFraction(v) || (createIfMissing && v === null)) localStorage.setItem(STORAGE_KEY, '1');
      } catch { /* хранилище закрыто / storage blocked */ }
    };

    // Сохранённое 0…1 — почти наверняка громкость плеера: поднимаем сразу. 0 и прочее не трогаем.
    // A stored 0…1 value is almost certainly a player volume: raise it now. 0 and others are kept.
    raiseStoredVolume(false);

    // Первый заход на сайт KVS: ждём kt_player.js и записываем 1 до запуска плеера.
    // Наблюдатель живёт только до конца разбора страницы.
    // First visit to a KVS site: wait for kt_player.js and write 1 before the player starts.
    // The observer lives only until the page is parsed.
    const watcher = new MutationObserver((records) => {
      for (const r of records) {
        for (const n of r.addedNodes) {
          if (n.nodeName === 'SCRIPT' && /kt_player\.js/.test(n.src || '')) {
            raiseStoredVolume(true);
            watcher.disconnect();
            return;
          }
        }
      }
    });
    watcher.observe(document, { childList: true, subtree: true });
    document.addEventListener('DOMContentLoaded', () => watcher.disconnect(), { once: true });

    // 2) Остальные плееры: подменяем volume у <video>/<audio> — 0.3 превращается в 1, 0 остаётся.
    //    Работает, когда Tampermonkey запускает скрипт в мире страницы; иначе выручает способ 3.
    //    Other players: patch volume on <video>/<audio> — 0.3 becomes 1, 0 stays. Works when the
    //    script runs in the page world; otherwise path 3 covers it.
    try {
      const proto = HTMLMediaElement.prototype;
      const native = Object.getOwnPropertyDescriptor(proto, 'volume');
      if (native?.set && native.configurable) {
        Object.defineProperty(proto, 'volume', {
          configurable: true,
          enumerable: native.enumerable,
          get() { return native.get.call(this); },
          set(v) {
            const raise = typeof v === 'number' && v > 0 && !userVolume.has(this);
            native.set.call(this, raise ? 1 : v);
          },
        });
      }
    } catch { /* не вышло — сработает способ 3 / failed — path 3 still works */ }

    // 3) Запасной способ: поднимаем громкость при её изменении и старте. Правки ограничены,
    //    чтобы не спорить с упрямым плеером бесконечно.
    //    Fallback: raise volume on change and on play. Corrections are capped.
    const MAX_FIXES = 10;
    const fixes = new WeakMap();
    const onMediaEvent = (e) => {
      const el = e.target;
      if (!(el instanceof HTMLMediaElement) || userVolume.has(el)) return;
      const v = el.volume;
      if (!(v > 0 && v < 1)) return;
      const n = (fixes.get(el) || 0) + 1;
      if (n > MAX_FIXES) return;
      fixes.set(el, n);
      el.volume = 1;
    };
    // События медиа не всплывают — ловим на перехвате. / Media events do not bubble — use capture.
    for (const type of ['volumechange', 'play', 'loadedmetadata']) {
      document.addEventListener(type, onMediaEvent, true);
    }
  }

  // =========================================================
  // Общее для жестов / Shared gesture helpers
  // =========================================================
  const TOP_DEAD = 0.12; // верх видео не трогаем (заголовок, кнопки) / top strip left alone
  const BOTTOM_DEAD = 0.22; // низ видео не трогаем (панель управления) / control bar left alone
  const INTERACTIVE = 'button, a[href], input, select, textarea, [role="button"], [role="slider"], [role="progressbar"], [role="menuitem"]';
  const RU = (navigator.language || '').startsWith('ru');

  // Видео под пальцем: видимое; если несколько — самое большое.
  // Video under the finger: visible; the largest one if several overlap.
  function videoAt(x, y) {
    let best = null;
    let bestArea = 0;
    for (const v of document.getElementsByTagName('video')) {
      const r = v.getBoundingClientRect();
      if (r.width < 120 || r.height < 80) continue;
      if (x < r.left || x > r.right || y < r.top || y > r.bottom) continue;
      const area = r.width * r.height;
      if (area > bestArea) { best = { video: v, rect: r }; bestArea = area; }
    }
    return best;
  }

  // Касание подходит для жеста: одно касание, по видео, не по кнопке плеера, не в служебной полосе.
  // A touch suits a gesture: single finger, over a video, not on a player control, not in a reserved strip.
  function gestureTarget(e, fullscreenOnly) {
    if (e.touches.length !== 1) return null;
    if (fullscreenOnly && !document.fullscreenElement) return null;
    const t = e.touches[0];
    const hit = videoAt(t.clientX, t.clientY);
    if (!hit || e.target.closest?.(INTERACTIVE)) return null;
    const fy = (t.clientY - hit.rect.top) / hit.rect.height;
    if (fy < TOP_DEAD || fy > 1 - BOTTOM_DEAD) return null;
    return { ...hit, x: t.clientX, y: t.clientY };
  }

  // Подсказка поверх видео. В полноэкранном режиме видно только содержимое полноэкранного
  // элемента, поэтому кладём её туда.
  // On-video hint. In fullscreen only the fullscreen element is visible, so the hint goes inside it.
  let hud = null;
  let hudTimer = 0;
  function showHud(rect, xFrac, text, ms) {
    if (!hud) {
      hud = document.createElement('div');
      hud.style.cssText =
        'position:fixed;z-index:2147483647;pointer-events:none;transform:translate(-50%,-50%);' +
        'background:rgba(0,0,0,.6);color:#fff;font:600 16px/1 sans-serif;padding:10px 14px;' +
        'border-radius:999px;white-space:nowrap;';
    }
    const parent = document.fullscreenElement || document.body;
    if (hud.parentNode !== parent) parent.appendChild(hud);
    hud.textContent = text;
    hud.style.left = rect.left + rect.width * xFrac + 'px';
    hud.style.top = rect.top + rect.height / 2 + 'px';
    hud.style.display = 'block';
    clearTimeout(hudTimer);
    hudTimer = setTimeout(() => { hud.style.display = 'none'; }, ms);
  }

  // Гасим клики над видео сразу после нашего жеста — плеер не должен принять жест за тап.
  // Swallow clicks over the video right after our gesture so the player does not see a tap.
  let blockClicksUntil = 0;
  let blockRect = null;
  function blockClicks(now, rect, ms) {
    blockClicksUntil = now + ms;
    blockRect = rect;
  }
  function onClickLike(e) {
    const r = blockRect;
    if (r && e.timeStamp < blockClicksUntil &&
        e.clientX >= r.left && e.clientX <= r.right && e.clientY >= r.top && e.clientY <= r.bottom) {
      e.preventDefault();
      e.stopImmediatePropagation();
    }
  }
  if (SEEK_ENABLED || SWIPE_ENABLED) {
    for (const type of ['click', 'dblclick']) window.addEventListener(type, onClickLike, true);
  }

  // =========================================================
  // Перемотка двойным тапом / Double-tap seek
  // =========================================================
  function setupSeek() {
    const DOUBLE_TAP_MS = 300; // окно для второго тапа / window for the second tap
    const SERIES_MS = 700; // окно для продолжения серии / window to continue a series
    const TAP_MAX_MS = 350; // дольше — это уже не тап / longer press is not a tap
    const TAP_MAX_MOVE = 20; // px; больше — это свайп / more is a swipe
    const SIDE_ZONE = 0.35; // левая и правая треть видео / left and right third of the video
    const SEC = RU ? 'с' : 's';

    let start = null; // текущее касание / current touch
    let pending = null; // первый тап, ждём второй / first tap awaiting the second
    let series = null; // идущая серия перемотки / running seek series

    // Сторона тапа: -1 слева, +1 справа, 0 — центр. / Tap side: -1 left, +1 right, 0 centre.
    function sideOf(rect, x) {
      const fx = (x - rect.left) / rect.width;
      if (fx < SIDE_ZONE) return -1;
      if (fx > 1 - SIDE_ZONE) return 1;
      return 0;
    }

    function seekBy(video, delta) {
      const d = video.duration;
      if (!Number.isFinite(d)) return false;
      video.currentTime = Math.min(Math.max(video.currentTime + delta, 0), Math.max(d - 0.5, 0));
      return true;
    }

    // Первый тап серии плеер уже обработал (обычно пауза/пуск) — возвращаем как было.
    // The player already handled the first tap (usually play/pause) — put it back.
    function restorePlayState(video, wasPaused) {
      setTimeout(() => {
        if (video.paused === wasPaused) return;
        if (wasPaused) video.pause();
        else video.play()?.catch?.(() => {});
      }, 60);
    }

    function hint(rect, side, total) {
      showHud(rect, side < 0 ? 0.2 : 0.8, side < 0 ? `« ${total} ${SEC}` : `${total} ${SEC} »`, SERIES_MS);
    }

    // Гасим тап для плеера и браузера: без клика, без двойного клика (полный экран) и без зума.
    // Swallow the tap for the player and the browser: no click, no dblclick (fullscreen), no zoom.
    function swallow(e, now, rect) {
      if (e.cancelable) e.preventDefault();
      e.stopPropagation();
      blockClicks(now, rect, SERIES_MS);
    }

    function onTouchStart(e) {
      const hit = gestureTarget(e, SEEK_FULLSCREEN_ONLY);
      // Состояние до того, как плеер отреагирует на тап. / State before the player reacts to the tap.
      start = hit && { x: hit.x, y: hit.y, time: e.timeStamp, video: hit.video, wasPaused: hit.video.paused };
    }

    function onTouchEnd(e) {
      const s = start;
      start = null;
      if (!s || e.touches.length) return;
      const t = e.changedTouches[0];
      if (!t || e.timeStamp - s.time > TAP_MAX_MS || Math.hypot(t.clientX - s.x, t.clientY - s.y) > TAP_MAX_MOVE) return;

      const rect = s.video.getBoundingClientRect();
      const side = sideOf(rect, t.clientX);
      const now = e.timeStamp;

      // Продолжение серии: каждый тап добавляет шаг. / Series continues: each tap adds a step.
      if (series && series.video === s.video && series.side === side && now - series.last < SERIES_MS) {
        if (!seekBy(s.video, side * SEEK_STEP)) return;
        series.total += SEEK_STEP;
        series.last = now;
        swallow(e, now, rect);
        hint(rect, side, series.total);
        return;
      }
      series = null;

      // Второй тап в той же боковой зоне — начинаем серию. / Second tap on the same side starts a series.
      if (side && pending && pending.video === s.video && pending.side === side && now - pending.time < DOUBLE_TAP_MS) {
        if (!seekBy(s.video, side * SEEK_STEP)) { pending = null; return; }
        series = { video: s.video, side, total: SEEK_STEP, last: now };
        swallow(e, now, rect);
        restorePlayState(s.video, pending.wasPaused);
        hint(rect, side, SEEK_STEP);
        pending = null;
        return;
      }

      // Обычный тап: пропускаем плееру, запоминаем как возможный первый.
      // Ordinary tap: let the player have it, remember it as a possible first tap.
      pending = side ? { video: s.video, side, time: now, wasPaused: s.wasPaused } : null;
    }

    // touchstart — пассивный (не мешает прокрутке); touchend — нет, чтобы погасить лишний тап.
    // touchstart is passive (does not slow scrolling); touchend is not, to swallow the extra tap.
    window.addEventListener('touchstart', onTouchStart, { capture: true, passive: true });
    window.addEventListener('touchend', onTouchEnd, { capture: true, passive: false });
    window.addEventListener('touchcancel', () => { start = null; }, { capture: true, passive: true });
  }

  // =========================================================
  // Свайпы яркости и громкости / Brightness and volume swipes
  // =========================================================
  // Веб-страница не может менять яркость экрана и системную громкость. Поэтому яркость —
  // это фильтр на самом видео (затемнение и осветление до 150%), а громкость — громкость
  // плеера от 0 до 100% от текущей системной.
  // A web page cannot change screen brightness or system volume. So brightness is a filter on
  // the video itself (dimming and brightening up to 150%), and volume is the player volume,
  // 0–100% of the current system volume.
  function setupSwipe() {
    const DECIDE_MOVE = 12; // px, после этого решаем, наш ли это жест / px before deciding
    const HUD_MS = 900;

    let cand = null; // касание, которое может стать свайпом / touch that may become a swipe
    let active = null; // идущий свайп / running swipe
    let brightness = 1; // общая для страницы, как в MX Player / page-wide, like MX Player
    const baseFilter = new WeakMap(); // исходный filter сайта у видео / site's own filter per video

    const clamp = (v, lo, hi) => Math.min(Math.max(v, lo), hi);
    const pct = (v) => Math.round(v * 100) + '%';

    function applyBrightness(video, b) {
      if (!baseFilter.has(video)) baseFilter.set(video, video.style.filter || '');
      const base = baseFilter.get(video);
      // Ровно 100% — фильтр убираем полностью, чтобы не тратить ресурсы. / At 100% drop the filter to save GPU work.
      video.style.filter = Math.abs(b - 1) < 0.005 ? base : `${base} brightness(${b.toFixed(2)})`.trim();
    }

    function setVolume(video, v) {
      userVolume.add(video);
      video.volume = v;
      if (v > 0 && video.muted) video.muted = false;
    }

    function onStart(e) {
      active = null;
      const hit = gestureTarget(e, SWIPE_FULLSCREEN_ONLY);
      cand = hit && { ...hit, left: hit.x < hit.rect.left + hit.rect.width / 2 };
    }

    function onMove(e) {
      if (!cand || e.touches.length !== 1) return;
      const t = e.touches[0];
      const dx = t.clientX - cand.x;
      const dy = t.clientY - cand.y;
      if (!active) {
        if (Math.hypot(dx, dy) < DECIDE_MOVE) return;
        // Горизонтальный или косой жест — не наш (перемотка свайпом у плеера, прокрутка и т. п.).
        // Horizontal or diagonal — not ours (player's swipe-seek, scrolling and so on).
        if (Math.abs(dy) < Math.abs(dx) * 1.5) { cand = null; return; }
        const v = cand.video;
        active = cand.left
          ? { kind: 'bright', from: brightness }
          : { kind: 'vol', from: v.muted ? 0 : v.volume };
      }
      if (e.cancelable) e.preventDefault(); // не прокручивать и не обновлять страницу / no scroll, no pull-to-refresh
      const delta = -dy / (cand.rect.height * SWIPE_SENSITIVITY);
      if (active.kind === 'bright') {
        brightness = clamp(active.from + delta, BRIGHTNESS_MIN, BRIGHTNESS_MAX);
        applyBrightness(cand.video, brightness);
        showHud(cand.rect, 0.25, (RU ? '☀ Яркость ' : '☀ Brightness ') + pct(brightness), HUD_MS);
      } else {
        const vol = clamp(active.from + delta, 0, 1);
        setVolume(cand.video, vol);
        showHud(cand.rect, 0.75, (vol ? '🔊 ' : '🔇 ') + (RU ? 'Громкость ' : 'Volume ') + pct(vol), HUD_MS);
      }
    }

    function onEnd(e) {
      if (active && cand) {
        // Свайп закончился — плеер не должен получить его как тап. / Do not let the player see the swipe as a tap.
        if (e.cancelable) e.preventDefault();
        blockClicks(e.timeStamp, cand.rect, 400);
      }
      if (!e.touches.length) { cand = null; active = null; }
    }

    window.addEventListener('touchstart', onStart, { capture: true, passive: true });
    window.addEventListener('touchend', onEnd, { capture: true, passive: false });
    window.addEventListener('touchcancel', () => { cand = null; active = null; }, { capture: true, passive: true });

    // Непассивный touchmove замедляет прокрутку, поэтому в режиме «только полный экран» он
    // подключается лишь на время полноэкранного режима.
    // A non-passive touchmove slows scrolling, so in fullscreen-only mode it is attached only
    // while fullscreen is on.
    const moveOpts = { capture: true, passive: false };
    if (!SWIPE_FULLSCREEN_ONLY) {
      window.addEventListener('touchmove', onMove, moveOpts);
    } else {
      document.addEventListener('fullscreenchange', () => {
        if (document.fullscreenElement) window.addEventListener('touchmove', onMove, moveOpts);
        else window.removeEventListener('touchmove', onMove, moveOpts);
      });
    }
  }

  // Запуск — в конце, когда все общие помощники уже объявлены.
  // Start at the end, once all shared helpers are declared.
  if (VOLUME_ENABLED) setupVolume();
  if (SEEK_ENABLED && !hostMatches(SEEK_EXCLUDE)) setupSeek();
  if (SWIPE_ENABLED) setupSwipe();
})();
