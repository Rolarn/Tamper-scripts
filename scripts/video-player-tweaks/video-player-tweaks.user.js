// ==UserScript==
// @name            Video players: volume 100% & double-tap seek
// @name:ru         Видеоплееры: громкость 100% и перемотка двойным тапом
// @namespace       https://github.com/Rolarn/Tamper-scripts
// @version         2.0.0
// @description     Stops websites from lowering video/audio volume and adds YouTube-style double-tap seeking to any HTML5 video on touch screens.
// @description:ru  Не даёт сайтам занижать громкость видео и аудио и добавляет любому HTML5-видео перемотку двойным тапом, как в YouTube.
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

  // --- Громкость / Volume ---
  const VOLUME_ENABLED = true;

  // --- Перемотка двойным тапом / Double-tap seek ---
  const SEEK_ENABLED = true;
  // Шаг перемотки, секунд. Каждый следующий тап в серии добавляет ещё столько же (10 → 20 → 30…).
  // Seek step, seconds. Every further tap in a series adds the same again (10 → 20 → 30…).
  const SEEK_STEP = 10;
  // Сайты со своей перемоткой двойным тапом — там наша не нужна.
  // Sites with their own double-tap seek — ours is not needed there.
  const SEEK_EXCLUDE = ['youtube.com'];
  // Работать только в полноэкранном режиме (надёжнее на сайтах с необычными плеерами).
  // Only in fullscreen (safer on sites with unusual players).
  const SEEK_FULLSCREEN_ONLY = false;
  // =========================================================

  const host = location.hostname;
  const hostMatches = (list) => list.some((part) => host.includes(part));
  if (hostMatches(EXCLUDE)) return;

  if (VOLUME_ENABLED) setupVolume();
  if (SEEK_ENABLED && !hostMatches(SEEK_EXCLUDE)) setupSeek();

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
          set(v) { native.set.call(this, typeof v === 'number' && v > 0 ? 1 : v); },
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
      if (!(el instanceof HTMLMediaElement)) return;
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
  // Перемотка двойным тапом / Double-tap seek
  // =========================================================
  function setupSeek() {
    const DOUBLE_TAP_MS = 300; // окно для второго тапа / window for the second tap
    const SERIES_MS = 700; // окно для продолжения серии / window to continue a series
    const TAP_MAX_MS = 350; // дольше — это уже не тап / longer press is not a tap
    const TAP_MAX_MOVE = 20; // px; больше — это свайп / more is a swipe
    const SIDE_ZONE = 0.35; // левая и правая треть видео / left and right third of the video
    const TOP_DEAD = 0.12; // верх видео не трогаем (заголовок, кнопки) / top strip left alone
    const BOTTOM_DEAD = 0.22; // низ видео не трогаем (панель управления) / control bar left alone
    const INTERACTIVE = 'button, a[href], input, select, textarea, [role="button"], [role="slider"], [role="progressbar"], [role="menuitem"]';

    let start = null; // текущее касание / current touch
    let pending = null; // первый тап, ждём второй / first tap awaiting the second
    let series = null; // идущая серия перемотки / running seek series
    let blockClicksUntil = 0;
    let blockRect = null; // клики гасим только над этим видео / clicks are swallowed only over this video
    const SEC = (navigator.language || '').startsWith('ru') ? 'с' : 's';

    // Видео под пальцем: видимое, с конечной длительностью; если несколько — самое большое.
    // Video under the finger: visible, finite duration; the largest one if several overlap.
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

    // Сторона тапа: -1 слева, +1 справа, 0 — центр или служебная зона.
    // Tap side: -1 left, +1 right, 0 = centre or a reserved strip.
    function sideOf(rect, x, y) {
      const fy = (y - rect.top) / rect.height;
      if (fy < TOP_DEAD || fy > 1 - BOTTOM_DEAD) return 0;
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

    // Подсказка «» 20 с» поверх видео. В полноэкранном режиме видно только содержимое
    // полноэкранного элемента, поэтому кладём подсказку туда.
    // The "» 20 s" hint over the video. In fullscreen only the fullscreen element is visible,
    // so the hint goes inside it.
    let hint = null;
    let hintTimer = 0;
    function showHint(rect, side, total) {
      if (!hint) {
        hint = document.createElement('div');
        hint.style.cssText =
          'position:fixed;z-index:2147483647;pointer-events:none;transform:translate(-50%,-50%);' +
          'background:rgba(0,0,0,.6);color:#fff;font:600 16px/1 sans-serif;padding:10px 14px;' +
          'border-radius:999px;white-space:nowrap;';
      }
      const parent = document.fullscreenElement || document.body;
      if (hint.parentNode !== parent) parent.appendChild(hint);
      hint.textContent = side < 0 ? `« ${total} ${SEC}` : `${total} ${SEC} »`;
      hint.style.left = rect.left + rect.width * (side < 0 ? 0.2 : 0.8) + 'px';
      hint.style.top = rect.top + rect.height / 2 + 'px';
      hint.style.display = 'block';
      clearTimeout(hintTimer);
      hintTimer = setTimeout(() => { hint.style.display = 'none'; }, SERIES_MS);
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

    function onTouchStart(e) {
      if (e.touches.length !== 1) { start = null; return; }
      if (SEEK_FULLSCREEN_ONLY && !document.fullscreenElement) { start = null; return; }
      const t = e.touches[0];
      const hit = videoAt(t.clientX, t.clientY);
      if (!hit || e.target.closest?.(INTERACTIVE)) { start = null; return; }
      // Состояние до того, как плеер отреагирует на тап. / State before the player reacts to the tap.
      start = { x: t.clientX, y: t.clientY, time: e.timeStamp, video: hit.video, wasPaused: hit.video.paused };
    }

    function onTouchEnd(e) {
      const s = start;
      start = null;
      if (!s || e.touches.length) return;
      const t = e.changedTouches[0];
      if (!t || e.timeStamp - s.time > TAP_MAX_MS || Math.hypot(t.clientX - s.x, t.clientY - s.y) > TAP_MAX_MOVE) return;

      const rect = s.video.getBoundingClientRect();
      const side = sideOf(rect, t.clientX, t.clientY);
      const now = e.timeStamp;

      // Продолжение серии: каждый тап добавляет шаг. / Series continues: each tap adds a step.
      if (series && series.video === s.video && series.side === side && now - series.last < SERIES_MS) {
        if (!seekBy(s.video, side * SEEK_STEP)) return;
        series.total += SEEK_STEP;
        series.last = now;
        block(e, now, rect);
        showHint(rect, side, series.total);
        return;
      }
      series = null;

      // Второй тап в той же боковой зоне — начинаем серию. / Second tap on the same side starts a series.
      if (side && pending && pending.video === s.video && pending.side === side && now - pending.time < DOUBLE_TAP_MS) {
        if (!seekBy(s.video, side * SEEK_STEP)) { pending = null; return; }
        series = { video: s.video, side, total: SEEK_STEP, last: now };
        block(e, now, rect);
        restorePlayState(s.video, pending.wasPaused);
        showHint(rect, side, SEEK_STEP);
        pending = null;
        return;
      }

      // Обычный тап: пропускаем плееру, запоминаем как возможный первый.
      // Ordinary tap: let the player have it, remember it as a possible first tap.
      pending = side ? { video: s.video, side, time: now, wasPaused: s.wasPaused } : null;
    }

    // Гасим тап для плеера и браузера: без клика, без двойного клика (полный экран) и без зума.
    // Swallow the tap for the player and the browser: no click, no dblclick (fullscreen), no zoom.
    function block(e, now, rect) {
      if (e.cancelable) e.preventDefault();
      e.stopPropagation();
      blockClicksUntil = now + SERIES_MS;
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

    // touchstart — пассивный (не мешает прокрутке); touchend — нет, чтобы погасить лишний тап.
    // touchstart is passive (does not slow scrolling); touchend is not, to swallow the extra tap.
    window.addEventListener('touchstart', onTouchStart, { capture: true, passive: true });
    window.addEventListener('touchend', onTouchEnd, { capture: true, passive: false });
    window.addEventListener('touchcancel', () => { start = null; }, { capture: true, passive: true });
    for (const type of ['click', 'dblclick']) window.addEventListener(type, onClickLike, true);
  }
})();
