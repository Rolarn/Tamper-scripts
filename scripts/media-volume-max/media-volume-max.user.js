// ==UserScript==
// @name            Media volume: always 100%
// @name:ru         Громкость плееров: всегда 100%
// @namespace       https://github.com/Rolarn/Tamper-scripts
// @version         2.0.0
// @description     Stops websites from lowering video/audio volume. Raises the saved volume of KVS (kt_player) players to 100% and turns any non-zero volume of other players into 100%.
// @description:ru  Не даёт сайтам занижать громкость видео и аудио. Поднимает сохранённую громкость плееров KVS (kt_player) до 100%, а у остальных плееров любую громкость выше нуля превращает в 100%.
// @author          Rolarn
// @license         MIT
// @homepageURL     https://github.com/Rolarn/Tamper-scripts/tree/main/scripts/media-volume-max
// @homepage        https://github.com/Rolarn/Tamper-scripts/tree/main/scripts/media-volume-max
// @supportURL      https://github.com/Rolarn/Tamper-scripts/issues
// @updateURL       https://raw.githubusercontent.com/Rolarn/Tamper-scripts/main/scripts/media-volume-max/media-volume-max.meta.js
// @downloadURL     https://raw.githubusercontent.com/Rolarn/Tamper-scripts/main/scripts/media-volume-max/media-volume-max.user.js
// @match           *://*/*
// @grant           none
// @run-at          document-start
// ==/UserScript==

(() => {
  'use strict';

  // ================= НАСТРОЙКИ / SETTINGS =================
  // Сайты, где скрипт не нужен (часть адреса сайта), например ['youtube.com', 'vk.com'].
  // Sites to skip (part of the host name), e.g. ['youtube.com', 'vk.com'].
  const EXCLUDE = [];
  // =========================================================

  if (EXCLUDE.some((part) => location.hostname.includes(part))) return;

  // ---------- 1) Плееры KVS (kt_player) — главный способ / KVS players — main path ----------
  // Плеер берёт громкость из хранилища сайта (localStorage "volume") и по ней же рисует иконку.
  // В мобильной версии ползунка нет, и там навсегда застревает, например, 0.3. Хранилище
  // доступно скрипту в любом режиме Tampermonkey, в отличие от подмены свойств страницы.
  // The player reads its volume from site storage (localStorage "volume") and draws the icon
  // from it. Mobile layouts have no slider, so a value like 0.3 sticks forever. Storage is
  // reachable in every Tampermonkey mode, unlike patching page properties.
  const STORAGE_KEY = 'volume';
  const isFraction = (v) => v !== null && Number(v) > 0 && Number(v) < 1;

  const raiseStoredVolume = (createIfMissing) => {
    try {
      const v = localStorage.getItem(STORAGE_KEY);
      if (isFraction(v) || (createIfMissing && v === null)) localStorage.setItem(STORAGE_KEY, '1');
    } catch { /* хранилище закрыто / storage blocked */ }
  };

  // Сохранённое значение 0…1 — почти наверняка громкость плеера: поднимаем сразу.
  // Значения 0 (звук выключен) и не похожие на громкость не трогаем.
  // A stored 0…1 value is almost certainly a player volume: raise it right away.
  // 0 (muted) and values that do not look like a volume are left alone.
  raiseStoredVolume(false);

  // Первый заход на сайт KVS, громкость ещё не сохранена: ждём подключения kt_player.js и
  // записываем 1 до запуска плеера. Наблюдатель живёт только до конца разбора страницы.
  // First visit to a KVS site with nothing stored yet: wait for kt_player.js to be attached
  // and write 1 before the player starts. The observer lives only until the page is parsed.
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

  // ---------- 2) Остальные плееры / Other players ----------
  // Подменяем свойство volume у <video>/<audio>: плеер пишет 0.3 — в элемент уходит 1;
  // 0 оставляем (так некоторые плееры выключают звук). Работает, когда Tampermonkey запускает
  // скрипт в мире страницы; иначе выручает способ 3.
  // Patch the volume property of <video>/<audio>: a player writes 0.3, the element gets 1;
  // 0 is kept (some players mute that way). Works when Tampermonkey runs the script in the
  // page world; otherwise path 3 covers it.
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

  // ---------- 3) Запасной способ, работает всегда / Fallback, always works ----------
  // Поднимаем громкость, когда плеер её меняет или начинает играть. Число правок ограничено,
  // чтобы не спорить бесконечно с упрямым плеером.
  // Raise the volume whenever a player changes it or starts playing. Corrections are capped
  // so we never fight a stubborn player forever.
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

  // События медиа не всплывают — ловим их на фазе перехвата (capture).
  // Media events do not bubble, so listen in the capture phase.
  for (const type of ['volumechange', 'play', 'loadedmetadata']) {
    document.addEventListener(type, onMediaEvent, true);
  }
})();
