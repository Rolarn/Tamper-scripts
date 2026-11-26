// ==UserScript==
// @name            Video players: volume 100% & double-tap seek
// @name:ru         Видеоплееры: громкость 100% и перемотка двойным тапом
// @namespace       https://github.com/Rolarn/Tamper-scripts
// @version         2.5.0
// @description     Stops websites from lowering video/audio volume and adds touch gestures to any HTML5 video: YouTube-style double-tap seek and MX Player-style swipes for seeking, brightness and volume, plus a button to open the video in MX Player.
// @description:ru  Не даёт сайтам занижать громкость и добавляет любому HTML5-видео жесты: перемотку двойным тапом, как в YouTube, свайпы перемотки, яркости и громкости, как в MX Player, и кнопку «открыть в MX Player».
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

  // --- Перемотка горизонтальным свайпом / Horizontal swipe seek ---
  // Свайп влево-вправо по видео — перемотка, как в MX Player: попасть по тонкой полосе
  // прокрутки плеера не нужно. Работает и в обычном, и в полноэкранном режиме.
  // Swipe left/right over the video to seek, like MX Player — no need to hit the player's thin
  // progress bar. Works both inline and in fullscreen.
  const SCRUB_ENABLED = true;
  const SCRUB_FULLSCREEN_ONLY = false;
  // Сколько секунд даёт свайп на всю ширину видео. / Seconds for a swipe across the full video width.
  const SCRUB_FULL_WIDTH_SEC = 120;

  // --- Кнопка «Открыть в MX Player» / "Open in MX Player" button ---
  // Касание видео показывает вверху по центру небольшую кнопку «▶ MX»; тап по ней ставит видео
  // на паузу и открывает его в MX Player с того же места.
  // Touching a video shows a small "▶ MX" button at the top centre; tapping it pauses the video
  // and opens it in MX Player at the same position.
  const MX_ENABLED = true;
  // Пакет MX Player: com.mxtech.videoplayer.ad — бесплатная, com.mxtech.videoplayer.pro — Pro.
  // MX Player package: .ad = free edition, .pro = Pro edition.
  const MX_PACKAGE = 'com.mxtech.videoplayer.ad';
  // Сколько кнопка видна после касания, мс. / How long the button stays visible after a touch, ms.
  const MX_BUTTON_MS = 10000;
  // Если сайт собирает видео из кусков (адрес blob:), скрипт ищет ссылку на скачивание на странице
  // и берёт самое высокое качество, но не выше этого. / For blob: videos the script looks for download
  // links on the page and takes the highest quality up to this height.
  const MX_MAX_HEIGHT = 1080;

  // --- Без автозапуска и со звуком / No autoplay, sound on ---
  // На этих сайтах видео не запускаются сами (только по вашему тапу) и не стоят без звука.
  // Часть адреса сайта: 'reactor.cc' подходит и для поддоменов вроде anime.reactor.cc.
  // On these sites videos never start by themselves (only on your tap) and are not muted.
  // Part of the host name: 'reactor.cc' also covers subdomains like anime.reactor.cc.
  const CLICK_TO_PLAY_SITES = ['reactor.cc', 'joyreactor.cc', 'joyreactor.com'];
  // Сколько мс после вашего тапа или клика запуск видео считается вашим.
  // How many ms after your tap or click a start of playback counts as yours.
  const GESTURE_WINDOW_MS = 1000;
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
  function unblockClicks() {
    blockClicksUntil = 0;
    blockRect = null;
  }
  function onClickLike(e) {
    const r = blockRect;
    if (r && e.timeStamp < blockClicksUntil &&
        e.clientX >= r.left && e.clientX <= r.right && e.clientY >= r.top && e.clientY <= r.bottom) {
      e.preventDefault();
      e.stopImmediatePropagation();
    }
  }
  if (SEEK_ENABLED || SWIPE_ENABLED || SCRUB_ENABLED) {
    for (const type of ['click', 'dblclick']) window.addEventListener(type, onClickLike, true);
  }

  // =========================================================
  // Перемотка двойным тапом / Double-tap seek
  // =========================================================
  function setupSeek() {
    const DOUBLE_TAP_MS = 300; // окно для второго тапа / window for the second tap
    const SERIES_MS = 1000; // окно для продолжения серии, как в YouTube / window to continue a series, like YouTube
    const GUARD_TAIL_MS = 500; // охрана паузы/пуска после серии / play-state guard after a series
    const GUARD_MAX_FIXES = 6; // не спорим с плеером бесконечно / never fight a player forever
    const TAP_MAX_MS = 350; // дольше — это уже не тап / longer press is not a tap
    const TAP_MAX_MOVE = 20; // px; больше — это свайп / more is a swipe
    const SIDE_ZONE = 0.35; // левая и правая треть видео / left and right third of the video
    const SEC = RU ? 'с' : 's';

    let start = null; // текущее касание / current touch
    let pending = null; // первый тап, ждём второй / first tap awaiting the second
    let series = null; // идущая серия перемотки / running seek series
    let guard = null; // охрана паузы/пуска / play-state guard
    let down = null; // состояние видео в момент касания / video state at touch-down

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

    // Охрана паузы/пуска. Первый тап серии плеер принимает за одиночный и ставит паузу (или пуск),
    // причём многие плееры делают это с задержкой 0,2–0,3 с, чтобы отличить тап от двойного.
    // Поэтому, пока идёт серия и ещё GUARD_TAIL_MS после неё, любое изменение паузы/пуска этого
    // видео сразу отменяется — когда бы и чем бы плеер его ни вызвал.
    // Play-state guard. The player takes the first tap of a series for a single tap and toggles
    // pause, often 0.2–0.3 s late to tell a tap from a double tap. So while the series runs and
    // GUARD_TAIL_MS after it, any play/pause change of that video is reverted right away.
    function startGuard(video, wantPaused) {
      guard = { video, wantPaused, until: performance.now() + SERIES_MS + GUARD_TAIL_MS, fixes: 0 };
      enforceGuard();
    }

    function extendGuard() {
      if (guard) guard.until = performance.now() + SERIES_MS + GUARD_TAIL_MS;
    }

    function enforceGuard() {
      const g = guard;
      if (!g) return;
      if (performance.now() > g.until || g.fixes >= GUARD_MAX_FIXES) { guard = null; return; }
      const v = g.video;
      if (v.paused === g.wantPaused) return;
      g.fixes++;
      if (g.wantPaused) v.pause();
      else v.play()?.catch?.(() => {});
    }

    const onPlayState = (e) => {
      if (guard && e.target === guard.video) enforceGuard();
    };

    // Касание вне стороны серии — это уже новое действие пользователя (например, пауза по центру):
    // охрану и гашение кликов снимаем до того, как плеер его получит. pointerdown приходит раньше touchstart,
    // и некоторые плееры реагируют уже на него — поэтому и состояние видео запоминаем здесь.
    // A touch outside the series side is a new user action (say, pause in the centre): drop the
    // guard and click swallowing before the player sees it. pointerdown comes before touchstart and some players
    // react to it already, so the video state is recorded here too.
    function onPointerDown(e) {
      if (e.pointerType !== 'touch') return;
      const hit = videoAt(e.clientX, e.clientY);
      down = hit && { video: hit.video, paused: hit.video.paused, time: performance.now() };
      const continuing = hit && series && hit.video === series.video && sideOf(hit.rect, e.clientX) === series.side;
      if (!continuing) {
        guard = null;
        unblockClicks();
      }
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
      const early = down && hit && down.video === hit.video && performance.now() - down.time < 200;
      const wasPaused = early ? down.paused : hit?.video.paused;
      start = hit && { x: hit.x, y: hit.y, time: e.timeStamp, video: hit.video, wasPaused };
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
        extendGuard();
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
        startGuard(s.video, pending.wasPaused);
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
    window.addEventListener('pointerdown', onPointerDown, { capture: true, passive: true });
    window.addEventListener('touchstart', onTouchStart, { capture: true, passive: true });
    window.addEventListener('touchend', onTouchEnd, { capture: true, passive: false });
    window.addEventListener('touchcancel', () => { start = null; }, { capture: true, passive: true });
    // События медиа не всплывают — ловим на перехвате. / Media events do not bubble — use capture.
    document.addEventListener('play', onPlayState, true);
    document.addEventListener('pause', onPlayState, true);
  }

  // =========================================================
  // Свайпы: перемотка, яркость, громкость / Swipes: seek, brightness, volume
  // =========================================================
  // Горизонтальный свайп — перемотка. Вертикальный: левая половина — яркость, правая — громкость.
  // Веб-страница не может менять яркость экрана и системную громкость. Поэтому яркость — это
  // фильтр на самом видео (затемнение и осветление до 150%), а громкость — громкость плеера
  // от 0 до 100% от текущей системной.
  // Horizontal swipe = seek. Vertical: left half = brightness, right half = volume.
  // A web page cannot change screen brightness or system volume. So brightness is a filter on
  // the video itself (dimming and brightening up to 150%), and volume is the player volume,
  // 0–100% of the current system volume.
  function setupSwipe() {
    const DECIDE_MOVE = 12; // px, после этого решаем, наш ли это жест / px before deciding
    const AXIS_RATIO = 1.5; // насколько одна ось должна преобладать / how much one axis must dominate
    const HUD_MS = 900;

    let cand = null; // касание, которое может стать свайпом / touch that may become a swipe
    let active = null; // идущий свайп / running swipe
    let brightness = 1; // общая для страницы, как в MX Player / page-wide, like MX Player
    const baseFilter = new WeakMap(); // исходный filter сайта у видео / site's own filter per video

    const clamp = (v, lo, hi) => Math.min(Math.max(v, lo), hi);
    const pct = (v) => Math.round(v * 100) + '%';
    const fs = () => !!document.fullscreenElement;
    const verticalAllowed = () => SWIPE_ENABLED && (!SWIPE_FULLSCREEN_ONLY || fs());
    const scrubAllowed = () => SCRUB_ENABLED && (!SCRUB_FULLSCREEN_ONLY || fs());

    // 1:05 или 1:02:05 / 1:05 or 1:02:05
    function clock(sec) {
      const t = Math.max(0, Math.round(sec));
      const h = Math.floor(t / 3600);
      const m = Math.floor((t % 3600) / 60);
      const ss = String(t % 60).padStart(2, '0');
      return h ? `${h}:${String(m).padStart(2, '0')}:${ss}` : `${m}:${ss}`;
    }

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
      cand = null;
      if (!verticalAllowed() && !scrubAllowed()) return;
      const hit = gestureTarget(e, false);
      cand = hit && { ...hit, left: hit.x < hit.rect.left + hit.rect.width / 2 };
    }

    function onMove(e) {
      if (!cand || e.touches.length !== 1) return;
      const t = e.touches[0];
      const dx = t.clientX - cand.x;
      const dy = t.clientY - cand.y;
      const v = cand.video;
      if (!active) {
        if (Math.hypot(dx, dy) < DECIDE_MOVE) return;
        const vertical = Math.abs(dy) >= Math.abs(dx) * AXIS_RATIO;
        const horizontal = Math.abs(dx) >= Math.abs(dy) * AXIS_RATIO;
        if (horizontal && scrubAllowed() && Number.isFinite(v.duration)) {
          active = { kind: 'scrub', from: v.currentTime, to: v.currentTime };
        } else if (vertical && verticalAllowed()) {
          active = cand.left ? { kind: 'bright', from: brightness } : { kind: 'vol', from: v.muted ? 0 : v.volume };
        } else {
          // Косой жест или выключенный режим — не наш (прокрутка, жесты плеера).
          // Diagonal or disabled — not ours (scrolling, the player's own gestures).
          cand = null;
          return;
        }
      }
      // Не прокручивать и не обновлять страницу (если событие можно отменить).
      // No scrolling or pull-to-refresh (when the event is cancelable).
      if (e.cancelable) e.preventDefault();

      if (active.kind === 'scrub') {
        // Во время свайпа только показываем, куда перемотаем, а перематываем при отпускании:
        // одна загрузка вместо десятков — быстрее и бережнее к сети и батарее.
        // While swiping only show the target; seek on release — one load instead of dozens.
        const delta = (dx / cand.rect.width) * SCRUB_FULL_WIDTH_SEC;
        active.to = clamp(active.from + delta, 0, Math.max(v.duration - 0.5, 0));
        const diff = active.to - active.from;
        showHud(cand.rect, 0.5, `${diff < 0 ? '−' : '+'}${clock(Math.abs(diff))} · ${clock(active.to)} / ${clock(v.duration)}`, HUD_MS);
        return;
      }
      const delta = -dy / (cand.rect.height * SWIPE_SENSITIVITY);
      if (active.kind === 'bright') {
        brightness = clamp(active.from + delta, BRIGHTNESS_MIN, BRIGHTNESS_MAX);
        applyBrightness(v, brightness);
        showHud(cand.rect, 0.25, (RU ? '☀ Яркость ' : '☀ Brightness ') + pct(brightness), HUD_MS);
      } else {
        const vol = clamp(active.from + delta, 0, 1);
        setVolume(v, vol);
        showHud(cand.rect, 0.75, (vol ? '🔊 ' : '🔇 ') + (RU ? 'Громкость ' : 'Volume ') + pct(vol), HUD_MS);
      }
    }

    function onEnd(e) {
      if (active && cand) {
        if (active.kind === 'scrub' && Math.abs(active.to - active.from) >= 0.5) cand.video.currentTime = active.to;
        // Свайп закончился — плеер не должен получить его как тап. / Do not let the player see the swipe as a tap.
        if (e.cancelable) e.preventDefault();
        blockClicks(e.timeStamp, cand.rect, 400);
      }
      if (!e.touches.length) { cand = null; active = null; }
    }

    window.addEventListener('touchstart', onStart, { capture: true, passive: true });
    window.addEventListener('touchend', onEnd, { capture: true, passive: false });
    window.addEventListener('touchcancel', () => { cand = null; active = null; }, { capture: true, passive: true });

    // touchmove: непассивный нужен, чтобы погасить прокрутку, но он замедляет прокрутку страницы.
    // Поэтому непассивный — только когда жесты могут быть вертикальными (полный экран или
    // SWIPE_FULLSCREEN_ONLY = false); для одной горизонтальной перемотки хватает пассивного:
    // горизонтальный свайп страницу не прокручивает.
    // touchmove: a non-passive listener can stop scrolling but slows page scrolling. So it is
    // non-passive only when vertical gestures are possible; horizontal seek alone works with a
    // passive one, since a horizontal swipe does not scroll the page.
    const ACTIVE = { capture: true, passive: false };
    const PASSIVE = { capture: true, passive: true };
    let mode = null;
    function attachMove() {
      const want = verticalAllowed() ? 'active' : scrubAllowed() ? 'passive' : 'none';
      if (want === mode) return;
      if (mode === 'active') window.removeEventListener('touchmove', onMove, ACTIVE);
      if (mode === 'passive') window.removeEventListener('touchmove', onMove, PASSIVE);
      if (want === 'active') window.addEventListener('touchmove', onMove, ACTIVE);
      if (want === 'passive') window.addEventListener('touchmove', onMove, PASSIVE);
      mode = want;
    }
    attachMove();
    document.addEventListener('fullscreenchange', attachMove);
  }

  // =========================================================
  // Кнопка «Открыть в MX Player» / "Open in MX Player" button
  // =========================================================
  // Видео передаётся в MX Player ссылкой intent:// — Firefox спросит «Открыть в другом приложении?».
  // Нужна обычная ссылка на файл или поток. Если сайт собирает видео в браузере из кусков
  // (адрес вида blob:), скрипт ищет замену: ссылку на скачивание на странице или адрес потока
  // .m3u8 среди загруженных страницей файлов. Не нашлось — кнопка не показывается.
  // MX не получит cookies и заголовки сайта: если сайт их требует, MX покажет ошибку.
  // The video is handed over with an intent:// link — Firefox asks "Open in another app?".
  // A plain file or stream URL is needed. For videos assembled in the browser (blob: URLs) the
  // script looks for a substitute: a download link on the page or an .m3u8 stream among the
  // page's loaded resources. If none is found, the button is not shown. MX does not get the
  // site's cookies or headers; sites that require them will fail in MX.
  function setupMxButton() {
    let btn = null;
    let current = null; // видео, к которому относится кнопка / the video the button belongs to
    let hideTimer = 0;

    const isHttp = (u) => /^https?:\/\//i.test(u || '');

    // Ссылки на скачивание с указанием качества: «…-720p.mp4», «/dload/…/720/…», текст «720p».
    // Без явного качества ссылку не берём — так не попадутся чужие ролики и превью.
    // Download links that state a quality ("…-720p.mp4", "/dload/…/720/…", "720p" text). Links
    // without a stated quality are skipped so other clips and previews are not picked up.
    function bestDownloadLink() {
      let best = '';
      let bestH = 0;
      for (const a of document.querySelectorAll('a[href]')) {
        const href = a.href;
        if (!isHttp(href) || !/\.(mp4|webm|mkv|mov)(\?|$)|\/dload\//i.test(href)) continue;
        const m = (href + ' ' + a.textContent).match(/(?:^|\D)(\d{3,4})p(?:\D|$)/i);
        const h = m ? Number(m[1]) : 0;
        if (h && h <= MX_MAX_HEIGHT && h > bestH) { best = href; bestH = h; }
      }
      return best;
    }

    // Первый адрес потока .m3u8, который загрузила страница (обычно это главный список качеств).
    // The first .m3u8 stream the page loaded (usually the master playlist).
    function loadedHlsUrl() {
      try {
        const entry = performance.getEntriesByType('resource').find((e) => /\.m3u8(\?|$)/i.test(e.name));
        return entry && isHttp(entry.name) ? entry.name : '';
      } catch { return ''; }
    }

    // Адрес, который можно отдать внешнему плееру, или ''. / A URL an external player can open, or ''.
    function playableUrl(video) {
      const src = video.currentSrc || video.src || video.querySelector('source[src]')?.src || '';
      if (isHttp(src)) return src;
      if (!/^blob:/i.test(src)) return '';
      return bestDownloadLink() || loadedHlsUrl();
    }

    function intentUrl(video) {
      const url = new URL(playableUrl(video));
      url.hash = ''; // # в адресе сломает intent-ссылку / a # would break the intent link
      const isHls = /\.m3u8(\?|$)/i.test(url.pathname + url.search);
      const extras = [
        'action=android.intent.action.VIEW',
        `scheme=${url.protocol.slice(0, -1)}`,
        `type=${isHls ? 'application/x-mpegURL' : 'video/*'}`,
        `package=${MX_PACKAGE}`,
        `S.title=${encodeURIComponent(document.title || url.hostname)}`,
      ];
      const pos = Math.floor((video.currentTime || 0) * 1000);
      if (pos > 1000) extras.push(`i.position=${pos}`);
      return `intent://${url.host}${url.pathname}${url.search}#Intent;${extras.join(';')};end`;
    }

    function hide() {
      clearTimeout(hideTimer);
      if (btn) btn.style.display = 'none';
      current = null;
      window.removeEventListener('scroll', hide, true);
    }

    function ensureButton() {
      if (btn) return btn;
      btn = document.createElement('button');
      btn.type = 'button';
      btn.textContent = '▶ MX';
      btn.setAttribute('aria-label', RU ? 'Открыть в MX Player' : 'Open in MX Player');
      btn.style.cssText =
        'position:fixed;z-index:2147483646;transform:translateX(-50%);display:none;margin:0;' +
        'height:28px;padding:0 11px;border-radius:14px;border:1px solid rgba(255,255,255,.28);' +
        'background:rgba(0,0,0,.42);color:rgba(255,255,255,.9);font:600 12px/26px sans-serif;' +
        'letter-spacing:.3px;cursor:pointer;-webkit-tap-highlight-color:transparent;touch-action:manipulation;';
      // Касания кнопки не должны доходить до плеера (в полноэкранном режиме он её предок).
      // Touches on the button must not reach the player (in fullscreen it is the button's ancestor).
      for (const type of ['pointerdown', 'pointerup', 'mousedown', 'mouseup', 'touchstart', 'touchend', 'dblclick']) {
        btn.addEventListener(type, (e) => e.stopPropagation(), { passive: true });
      }
      btn.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        const v = current;
        if (!v || !playableUrl(v)) { hide(); return; }
        const link = intentUrl(v);
        v.pause();
        hide();
        const a = document.createElement('a');
        a.href = link;
        a.target = '_top';
        a.rel = 'noopener';
        document.body.appendChild(a);
        a.click();
        a.remove();
      });
      return btn;
    }

    function show(video, rect) {
      const b = ensureButton();
      const parent = document.fullscreenElement || document.body;
      if (b.parentNode !== parent) parent.appendChild(b);
      b.style.left = rect.left + rect.width / 2 + 'px';
      b.style.top = Math.max(rect.top, 0) + 8 + 'px';
      b.style.display = 'block';
      current = video;
      clearTimeout(hideTimer);
      hideTimer = setTimeout(hide, MX_BUTTON_MS);
      // При прокрутке кнопка отстала бы от видео — прячем. / Hide on scroll so it never drifts off the video.
      window.addEventListener('scroll', hide, { capture: true, passive: true });
    }

    function onTouchStart(e) {
      if (e.touches.length !== 1 || (btn && e.target === btn)) return;
      const t = e.touches[0];
      const hit = videoAt(t.clientX, t.clientY);
      if (hit && playableUrl(hit.video)) show(hit.video, hit.rect);
    }

    window.addEventListener('touchstart', onTouchStart, { capture: true, passive: true });
    document.addEventListener('fullscreenchange', hide);
  }

  // =========================================================
  // Без автозапуска и со звуком / No autoplay, sound on
  // =========================================================
  // Атрибут autoplay снимается мало где: многие сайты (и reactor) запускают видео из скрипта,
  // когда оно появляется на экране. Поэтому, как в проверенных скриптах «click-to-play»,
  // любой запуск, который не последовал сразу за вашим тапом, клавишей или кликом, тут же
  // ставится на паузу. Прокрутка жестом не считается: после неё браузер не шлёт click/pointerup.
  // Removing the autoplay attribute is rarely enough: many sites (reactor included) start videos
  // from script when they scroll into view. So, like proven click-to-play scripts, any start that
  // does not follow your tap, key press or click right away is paused at once. A scroll gesture
  // does not count: the browser sends no click/pointerup after it.
  function setupClickToPlay() {
    const MAX_UNMUTE_FIXES = 10;
    let lastGesture = -Infinity;
    const prepared = new WeakSet();
    const unmuteFixes = new WeakMap();

    const markGesture = (e) => { if (e.isTrusted) lastGesture = performance.now(); };
    const userActive = () => performance.now() - lastGesture < GESTURE_WINDOW_MS;
    for (const type of ['click', 'pointerup', 'keydown']) {
      window.addEventListener(type, markGesture, { capture: true, passive: true });
    }
    // Некоторые плееры запускаются уже по нажатию пальца — его считаем, только если палец на видео
    // (нажатие в начале прокрутки страницы не должно разрешать автозапуск).
    // Some players start on pointerdown already — it counts only when the finger is on a video
    // (a press that starts a page scroll must not allow autoplay).
    window.addEventListener('pointerdown', (e) => {
      if (e.isTrusted && videoAt(e.clientX, e.clientY)) lastGesture = performance.now();
    }, { capture: true, passive: true });

    // Новое видео: без autoplay, без muted, загружаем только начало (экономия трафика).
    // New video: no autoplay, not muted, preload metadata only (saves data).
    function prepare(el) {
      if (prepared.has(el)) return;
      prepared.add(el);
      el.autoplay = false;
      el.removeAttribute('autoplay');
      el.defaultMuted = false; // снимает атрибут muted / clears the muted attribute
      el.muted = false;
      if (el.preload !== 'none') el.preload = 'metadata';
      if (!el.paused && !userActive()) el.pause();
    }

    function scanNode(n) {
      if (n.nodeType !== 1) return;
      if (n.nodeName === 'VIDEO' || n.nodeName === 'AUDIO') prepare(n);
      else if (n.firstElementChild) for (const m of n.querySelectorAll('video, audio')) prepare(m);
    }

    new MutationObserver((records) => {
      for (const r of records) for (const n of r.addedNodes) scanNode(n);
    }).observe(document, { childList: true, subtree: true });
    scanNode(document.documentElement);

    // Запуск не по вашему действию — сразу пауза. / A start you did not trigger is paused at once.
    document.addEventListener('play', (e) => {
      const el = e.target;
      if (!(el instanceof HTMLMediaElement)) return;
      prepare(el);
      if (!userActive()) el.pause();
    }, true);

    // Сайт снова выключил звук сам — включаем обратно (ваше выключение кнопкой не трогаем).
    // The site muted again on its own — unmute (a mute you did yourself is kept).
    document.addEventListener('volumechange', (e) => {
      const el = e.target;
      if (!(el instanceof HTMLMediaElement) || !el.muted || userActive()) return;
      const n = (unmuteFixes.get(el) || 0) + 1;
      if (n > MAX_UNMUTE_FIXES) return;
      unmuteFixes.set(el, n);
      el.muted = false;
    }, true);
  }

  // Запуск — в конце, когда все общие помощники уже объявлены.
  // Start at the end, once all shared helpers are declared.
  if (VOLUME_ENABLED) setupVolume();
  if (SEEK_ENABLED && !hostMatches(SEEK_EXCLUDE)) setupSeek();
  if (SWIPE_ENABLED || SCRUB_ENABLED) setupSwipe();
  if (MX_ENABLED) setupMxButton();
  if (hostMatches(CLICK_TO_PLAY_SITES)) setupClickToPlay();
})();
