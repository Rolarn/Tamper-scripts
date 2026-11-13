// ==UserScript==
// @name            Inoreader: inline photos & quick navigation
// @name:ru         Inoreader: фото прямо в ленте и быстрая навигация
// @namespace       https://github.com/Rolarn/Tamper-scripts
// @version         2.0.0
// @description     Floating buttons for the whole Inoreader. In photo folders, shows the full-size photo from the post instead of the empty entry body, with a "save and next" button.
// @description:ru  Плавающие кнопки во всём Inoreader. В фото-папках вместо пустого тела записи показывает фото из поста в максимальном размере и кнопку «сохранить и дальше».
// @author          Rolarn
// @license         MIT
// @homepageURL     https://github.com/Rolarn/Tamper-scripts/tree/main/scripts/inoreader-photo-inline
// @homepage        https://github.com/Rolarn/Tamper-scripts/tree/main/scripts/inoreader-photo-inline
// @supportURL      https://github.com/Rolarn/Tamper-scripts/issues
// @updateURL       https://raw.githubusercontent.com/Rolarn/Tamper-scripts/main/scripts/inoreader-photo-inline/inoreader-photo-inline.meta.js
// @downloadURL     https://raw.githubusercontent.com/Rolarn/Tamper-scripts/main/scripts/inoreader-photo-inline/inoreader-photo-inline.user.js
// @match           *://*.inoreader.com/*
// @noframes
// @grant           GM_xmlhttpRequest
// @grant           GM_setClipboard
// @grant           GM_registerMenuCommand
// @connect         tumblr.com
// @connect         media.tumblr.com
// @connect         lesaintdesseins.fr
// @connect         *
// @run-at          document-idle
// ==/UserScript==

(() => {
  'use strict';

  // ================= НАСТРОЙКИ / SETTINGS =================
  // Папки с фото-лентами (точные названия). В них и в лентах внутри них: показываем фото,
  // первая кнопка = «сохранить и дальше». Везде ещё первая кнопка = «открыть пост».
  // Photo folders (exact names). There: inline photo, main button = "save & next".
  // Elsewhere the main button = "open post in a new tab".
  const PHOTO_FOLDERS = ['Photo_every', 'Photo_Tumblr'];
  // Сколько следующих записей подгружать заранее (0 — выключить).
  // How many upcoming entries to prefetch (0 = off).
  const PRELOAD = 2;
  // В фото-папках тап по заголовку открытой записи: открыть пост и перейти к следующей.
  // In photo folders, tapping the open entry's title opens the post and moves on.
  const TITLE_TAP_NEXT = true;
  // Максимальная высота фото на экране. / Max on-screen photo height.
  const IMG_MAX_HEIGHT = '80vh';
  // Плавающие кнопки: отступы от правого и нижнего края, px. / Floating buttons offset, px.
  const FAB_RIGHT = 14;
  const FAB_BOTTOM = 115;
  // Имя файла: подпись под фото + короткий номер поста; false — исходное имя файла.
  // File name: post caption + short post id; false = original file name.
  const NAME_FROM_CAPTION = true;
  // Всплывающие подсказки. / Toast messages.
  const TOASTS = true;
  // =========================================================

  const CACHE_LIMIT = 150; // постов в памяти / posts kept in memory
  const NET_TIMEOUT = 25000; // мс / ms
  const SCAN_DELAY = 100; // пауза перед проверкой страницы, мс / debounce before a page scan, ms

  const errors = [];
  const logError = (text) => {
    errors.push(text);
    if (errors.length > 30) errors.shift();
  };

  // ---------- Определение фото-папки / Photo folder detection ----------
  const escapeRe = (t) => t.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const FOLDER_URL_RE = PHOTO_FOLDERS.length
    ? new RegExp('/folder/(?:' + PHOTO_FOLDERS.map(escapeRe).join('|') + ')(?:[/?#]|$)')
    : null;

  // Смотрим папки самой записи (data-tags) — работает и в отдельной ленте внутри папки;
  // запасной признак — адрес страницы.
  // Check the entry's own folders (data-tags), so single feeds inside a folder work too;
  // the page URL is a fallback.
  function isPhotoArt(art) {
    if (!art) return false;
    try {
      const tags = JSON.parse(art.getAttribute('data-tags') || 'null');
      if (tags && Object.values(tags).some((t) => PHOTO_FOLDERS.includes(String(t)))) return true;
    } catch { /* не JSON / not JSON */ }
    if (!FOLDER_URL_RE) return false;
    let url = location.href;
    try { url = decodeURIComponent(url); } catch { /* оставляем как есть / keep as is */ }
    return FOLDER_URL_RE.test(url);
  }

  // ---------- Стили / Styles ----------
  const css = document.createElement('style');
  css.textContent = `
    .article_full_contents.tmx-photo > :not(.tmx-box) { display: none !important; }
    .tmx-skip { display: none !important; }
    .tmx-box { padding: 8px 0 14px; text-align: center; }
    .tmx-item { margin: 0 0 10px; }
    .tmx-item img { max-width: 100%; max-height: ${IMG_MAX_HEIGHT}; height: auto; width: auto; display: block; margin: 0 auto; border-radius: 4px; }
    .tmx-meta { font: 12px sans-serif; opacity: .6; margin-top: 4px; }
    .tmx-msg { font: 14px sans-serif; opacity: .75; padding: 18px 8px; }
    .tmx-btn { font: 600 15px sans-serif; min-height: 44px; padding: 0 16px; border-radius: 10px; border: 1px solid #1a73e8;
               background: #1a73e8; color: #fff; cursor: pointer; touch-action: manipulation; }
    .tmx-btn.tmx-small { min-height: 36px; font-size: 14px; padding: 0 12px; margin-top: 6px; }
    .tmx-btn[disabled] { opacity: .5; }
    .tmx-fab { position: fixed; right: ${FAB_RIGHT}px; bottom: ${FAB_BOTTOM}px; z-index: 2147483000;
               display: none; flex-direction: column; gap: 14px; }
    .tmx-fab button { width: 58px; height: 58px; border-radius: 50%; border: none; padding: 0; cursor: pointer;
               display: flex; align-items: center; justify-content: center; color: #fff;
               box-shadow: 0 2px 8px rgba(0,0,0,.45); -webkit-tap-highlight-color: transparent; touch-action: manipulation; }
    .tmx-fab button svg { width: 28px; height: 28px; pointer-events: none; }
    .tmx-fab .tmx-ic-open, .tmx-fab .tmx-normal .tmx-ic-save { display: none; }
    .tmx-fab .tmx-normal .tmx-ic-open { display: block; }
    .tmx-fab .tmx-fab-save { background: #1a73e8; }
    .tmx-fab .tmx-fab-save.tmx-normal { background: #00897b; }
    .tmx-fab .tmx-fab-skip { background: rgba(60,60,60,.88); }
    .tmx-fab button[disabled] { opacity: .4; }
    .tmx-fab button:active { transform: scale(.93); }
    .tmx-toast { position: fixed; left: 50%; bottom: 150px; transform: translateX(-50%); z-index: 2147483647;
               background: rgba(0,0,0,.82); color: #fff; font: 14px sans-serif; padding: 7px 13px; border-radius: 8px;
               pointer-events: none; max-width: 90vw; text-align: center; }
  `;
  document.head.appendChild(css);

  // ---------- Мелкие помощники / Small helpers ----------
  // Пишем в DOM только при реальном изменении — не будим наблюдатель зря.
  // Touch the DOM only on real changes so the observer is not woken up for nothing.
  const setDisplay = (el, value) => { if (el.style.display !== value) el.style.display = value; };
  const setDisabled = (el, value) => { if (el.disabled !== value) el.disabled = value; };

  let toastEl = null;
  let toastTimer = 0;
  function toast(text) {
    if (!TOASTS) return;
    if (!toastEl) {
      toastEl = document.createElement('div');
      toastEl.className = 'tmx-toast';
      document.body.appendChild(toastEl);
    }
    toastEl.textContent = text;
    setDisplay(toastEl, 'block');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => setDisplay(toastEl, 'none'), 2200);
  }

  // ---------- Сеть / Network ----------
  function gmFetch(url, { responseType, headers = {} } = {}) {
    return new Promise((resolve, reject) => {
      GM_xmlhttpRequest({
        method: 'GET',
        url,
        timeout: NET_TIMEOUT,
        responseType,
        headers,
        onload: (r) => (r.status >= 200 && r.status < 300 ? resolve(r) : reject(new Error('HTTP ' + r.status))),
        onerror: () => reject(new Error('сеть/доступ')),
        onabort: () => reject(new Error('запрос прерван')),
        ontimeout: () => reject(new Error('таймаут')),
      });
    });
  }

  // ---------- Разбор картинок / Image parsing ----------
  const toAbs = (u, base) => { try { return new URL(u, base).href; } catch { return ''; } };
  const uniq = (list) => [...new Set(list.filter(Boolean))];
  const parseDoc = (html) => new DOMParser().parseFromString(html, 'text/html');
  const isTumblrMedia = (u) => /\/\/[^/]*media\.tumblr\.com\//.test(u);
  const isAvatarLike = (u) => /avatar|\/s\d+x\d+u?_c\d\//.test(u);
  const LAZY_ATTRS = ['data-original-src', 'data-orig-src', 'data-original', 'data-lazy-src', 'data-src', 'src'];

  // Самый большой вариант из srcset, иначе src (с учётом «ленивых» атрибутов).
  // Largest srcset candidate, otherwise src (lazy-loading attributes included).
  function bestFromImg(img, base) {
    let best = '';
    let bestW = -1;
    const srcset = img.getAttribute('srcset') || img.getAttribute('data-srcset') || '';
    for (const part of srcset.split(/,\s+/)) {
      const m = part.trim().match(/^(\S+)(?:\s+(\d+(?:\.\d+)?)([wx]))?$/);
      if (!m) continue;
      const w = m[2] ? parseFloat(m[2]) * (m[3] === 'x' ? 1000 : 1) : 0;
      // При равенстве берём последний — обычно он крупнее. / On ties take the last one, usually larger.
      if (w >= bestW) { bestW = w; best = m[1]; }
    }
    if (!best) {
      for (const attr of LAZY_ATTRS) {
        const v = img.getAttribute(attr);
        if (v && !v.startsWith('data:')) { best = v; break; }
      }
    }
    return best ? toAbs(best, base) : '';
  }

  function ogImages(doc, base) {
    const metas = doc.querySelectorAll('meta[property="og:image"], meta[property="og:image:secure_url"], meta[name="twitter:image"]');
    return uniq([...metas].map((m) => toAbs(m.getAttribute('content') || '', base)));
  }

  // ---------- Подписи для имён файлов / Captions for file names ----------
  const captions = new Map(); // адрес поста → подпись / post URL → caption

  function setCaption(postUrl, text, onlyIfEmpty = false) {
    if (onlyIfEmpty && captions.has(postUrl)) return;
    const firstLine = String(text || '').split(/\r?\n/).map((x) => x.trim()).find(Boolean) || '';
    const clean = firstLine
      .replace(/[\\/:*?"<>|#%\u0000-\u001f]/g, ' ') // eslint-disable-line no-control-regex
      .replace(/\s+/g, ' ')
      .replace(/^[.\s]+|[.\s]+$/g, '')
      .slice(0, 80)
      .trim();
    if (clean) captions.set(postUrl, clean);
  }

  // Короткий устойчивый номер: хвост id поста (или случайный, если id в адресе нет).
  // Short stable number: tail of the post id (random if the URL has no id).
  function shortId(postUrl) {
    const m = postUrl.match(/(\d{6,})(?!.*\d{6,})/);
    return m ? m[1].slice(-6) : String(Math.floor(100000 + Math.random() * 900000));
  }

  // ---------- Загрузка поста: Tumblr / Post loading: Tumblr ----------
  function tumblrInfo(url) {
    let u;
    try { u = new URL(url); } catch { return null; }
    let m;
    if (u.hostname.endsWith('.tumblr.com') && u.hostname !== 'www.tumblr.com' && (m = u.pathname.match(/^\/post\/(\d+)/))) {
      return { host: u.hostname, id: m[1] };
    }
    if (u.hostname === 'www.tumblr.com' && (m = u.pathname.match(/^\/(?:blog\/(?:view\/)?)?([\w-]+)\/(\d+)/))) {
      return { host: m[1] + '.tumblr.com', id: m[2] };
    }
    return null;
  }

  function largestLegacyPhoto(obj) {
    let bestKey = '';
    let bestW = -1;
    for (const key of Object.keys(obj)) {
      const m = key.match(/^photo-url-(\d+)$/);
      if (m && Number(m[1]) > bestW) { bestW = Number(m[1]); bestKey = key; }
    }
    return bestKey ? obj[bestKey] : '';
  }

  async function loadTumblr(url, info) {
    // 1) Старый API v1: отдаёт пост с полным набором размеров, работает без входа.
    //    Legacy v1 API: returns the post with every size variant, no login needed.
    try {
      const r = await gmFetch(`https://${info.host}/api/read/json?id=${info.id}`);
      const m = r.responseText.match(/\{[\s\S]*\}/);
      const post = m && (JSON.parse(m[0]).posts || [])[0];
      if (post) {
        const bodyHtml = [post['regular-body'], post['photo-caption'], post.answer, post['link-description']]
          .filter(Boolean).join('\n');
        const doc = parseDoc(bodyHtml);

        let urls = [];
        if (Array.isArray(post.photos) && post.photos.length) urls = post.photos.map(largestLegacyPhoto);
        else if (largestLegacyPhoto(post)) urls = [largestLegacyPhoto(post)];
        if (!urls.length) urls = [...doc.querySelectorAll('img')].map((i) => bestFromImg(i, url)).filter(isTumblrMedia);
        urls = uniq(urls).filter((u) => !isAvatarLike(u));

        // Подпись: заголовок поста или первая строка текста под фото.
        // Caption: post title or the first text line under the photo.
        for (const n of doc.querySelectorAll('figure, img, script, style')) n.remove();
        const blocks = [...doc.querySelectorAll('h1, h2, h3, p, li, blockquote')].map((n) => n.textContent);
        setCaption(url, post['regular-title'] || blocks.find((t) => t.trim()) || doc.body.textContent || post.slug);

        if (urls.length) return urls;
      }
    } catch (e) {
      logError('api v1 ' + url + ' :: ' + e.message);
    }

    // 2) Запасной путь: страница поста (с куками Tumblr из браузера), берём og:image.
    //    Fallback: the post page (with the browser's Tumblr cookies), take og:image.
    const r = await gmFetch(url, { headers: { Accept: 'text/html' } });
    if (/\/(login|safe-mode|privacy\/consent)/.test(r.finalUrl || '')) throw new Error('Tumblr просит вход');
    const urls = ogImages(parseDoc(r.responseText), url).filter((u) => isTumblrMedia(u) && !isAvatarLike(u));
    if (!urls.length) throw new Error('фото в посте не найдено');
    return urls;
  }

  // ---------- Загрузка поста: обычный сайт / Post loading: generic site ----------
  const IMAGE_EXT_RE = /\.(jpe?g|png|webp|gif|avif)(\?|#|$)/i;
  const JUNK_IMG_RE = /gravatar|avatar|emoji|logo|favicon/i;

  async function loadGeneric(url) {
    const r = await gmFetch(url, { headers: { Accept: 'text/html' } });
    const base = r.finalUrl || url;
    const doc = parseDoc(r.responseText);

    const ogTitle = doc.querySelector('meta[property="og:title"]');
    setCaption(url, ogTitle?.getAttribute('content') || doc.querySelector('h1')?.textContent || '');

    const scope = doc.querySelector('.entry-content, .post-content, .post-body, article, main') || doc.body;
    let urls = [...scope.querySelectorAll('img')].map((img) => {
      const wAttr = parseInt(img.getAttribute('width') || '0', 10);
      if (wAttr && wAttr < 200) return '';
      const href = img.closest('a[href]')?.getAttribute('href') || '';
      // Ссылка вокруг картинки на полный файл. / Link around the image to the full file.
      if (IMAGE_EXT_RE.test(href)) return toAbs(href, base);
      return bestFromImg(img, base);
    }).filter((u) => u && !JUNK_IMG_RE.test(u));
    urls = uniq(urls);
    if (!urls.length) urls = ogImages(doc, base).slice(0, 1);
    if (!urls.length) throw new Error('фото на странице не найдено');
    return urls;
  }

  // ---------- Кэш постов с ограничением размера / Size-limited post cache ----------
  const cache = new Map(); // адрес поста → Promise<string[]> / post URL → Promise<string[]>

  function getPhotos(url) {
    const hit = cache.get(url);
    if (hit) {
      // Переносим в конец: недавно использованные живут дольше. / Move to the end (LRU).
      cache.delete(url);
      cache.set(url, hit);
      return hit;
    }
    const info = tumblrInfo(url);
    const promise = (info ? loadTumblr(url, info) : loadGeneric(url)).catch((e) => {
      logError(url + ' :: ' + e.message);
      // Ошибки не кэшируем: при повторном открытии будет новая попытка.
      // Failures are not cached: reopening the entry retries.
      cache.delete(url);
      throw e;
    });
    cache.set(url, promise);
    if (cache.size > CACHE_LIMIT) {
      const oldest = cache.keys().next().value;
      cache.delete(oldest);
      captions.delete(oldest);
    }
    return promise;
  }

  // ---------- Сохранение / Saving ----------
  const MIME_EXT = { 'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp', 'image/gif': 'gif', 'image/avif': 'avif' };

  function fileName(imgUrl, postUrl, idx, mime) {
    let last = '';
    try { last = decodeURIComponent(new URL(imgUrl).pathname.split('/').pop()); } catch { /* запасное имя / fallback name */ }
    const urlExt = (last.match(/\.(\w{3,4})$/) || [])[1];
    const ext = MIME_EXT[mime] || urlExt || 'jpg';
    const caption = NAME_FROM_CAPTION && captions.get(postUrl);
    if (caption) return `${caption}_${shortId(postUrl)}${idx ? '_' + (idx + 1) : ''}.${ext}`;
    const stem = last.replace(/\.\w{3,4}$/, '').replace(/[\\/:*?"<>|]/g, '_') || 'image_' + Date.now();
    return `${stem}.${ext}`;
  }

  // true — файл отдан браузеру на сохранение; false — не вышло, картинка открыта во вкладке.
  // Firefox на Android всегда показывает диалог загрузки — скрипт это обойти не может.
  // true = handed to the browser for saving; false = failed, image opened in a tab.
  // Firefox for Android always shows its download dialog; a userscript cannot skip it.
  async function saveImage(imgUrl, postUrl, idx, referer = postUrl) {
    try {
      const r = await gmFetch(imgUrl, {
        responseType: 'blob',
        headers: { Accept: 'image/avif,image/webp,image/png,image/jpeg,image/*', Referer: referer },
      });
      const blob = r.response;
      if (!(blob instanceof Blob) || !blob.type.startsWith('image/') || !blob.size) {
        throw new Error('ответ не картинка (' + (blob && blob.type) + ')');
      }
      const objectUrl = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = objectUrl;
      a.download = fileName(imgUrl, postUrl, idx, blob.type);
      a.style.display = 'none';
      document.body.appendChild(a);
      a.click();
      setTimeout(() => { URL.revokeObjectURL(objectUrl); a.remove(); }, 60000);
      return true;
    } catch (e) {
      logError('save ' + imgUrl + ' :: ' + e.message);
      window.open(imgUrl, '_blank');
      return false;
    }
  }

  async function saveAll(st) {
    let okAll = true;
    for (let i = 0; i < st.urls.length; i++) {
      okAll = (await saveImage(st.urls[i], st.postUrl, i, st.native ? location.href : st.postUrl)) && okAll;
    }
    return okAll;
  }

  // ---------- Записи Inoreader / Inoreader entries ----------
  const fcOf = (art) => art.querySelector(':scope > .article_full_contents');
  const linkOf = (art) => art.querySelector('a[id^="burl_"]')?.href || '';
  const fcIsOpen = (fc) => fc.style.display !== 'none' && fc.childElementCount > 0;
  const isOpen = (art) => { const fc = fcOf(art); return !!fc && fcIsOpen(fc); };

  function nextArticle(art) {
    let n = art.nextElementSibling;
    while (n && !n.classList.contains('ar')) n = n.nextElementSibling;
    return n;
  }

  function currentOpen() {
    let first = null;
    for (const fc of document.querySelectorAll('.ar > .article_full_contents')) {
      if (!fcIsOpen(fc)) continue;
      const art = fc.parentElement;
      first ??= art;
      if (art.getBoundingClientRect().bottom > 80) return art;
    }
    return first;
  }

  // Открыть запись так же, как тап пальцем по её строке (у Inoreader там обработчик onmouseup).
  // Open an entry the same way a tap on its row does (Inoreader listens to onmouseup there).
  function openArticle(art) {
    const el = art.querySelector('.article_header_text') || art.querySelector('.article_header') || art;
    el.dispatchEvent(new MouseEvent('mouseup', { bubbles: true, cancelable: true, button: 0 }));
  }

  function pressKey(key, code) {
    for (const type of ['keydown', 'keyup']) {
      document.body.dispatchEvent(new KeyboardEvent(type, {
        key, code: 'Key' + key.toUpperCase(), keyCode: code, which: code, bubbles: true, cancelable: true,
      }));
    }
  }

  function goNext(art) {
    const next = nextArticle(art);
    if (!next) { toast('Дальше записей пока нет — прокрутите список'); return; }
    openArticle(next);
    // Запасной способ — горячая клавиша J, если за секунду ничего не открылось.
    // Fallback: the J hotkey if nothing opened within a second.
    setTimeout(() => {
      if (next.isConnected && art.isConnected && !isOpen(next) && isOpen(art)) pressKey('j', 74);
    }, 1200);
  }

  // Ничего не открыто: открываем первую видимую запись. / Nothing open: open the first visible entry.
  function goFirst() {
    const arts = [...document.querySelectorAll('.ar')];
    const first = arts.find((a) => a.getBoundingClientRect().bottom > 60) || arts[0];
    if (first) openArticle(first); else toast('Записей нет');
  }

  // Картинки, которые Inoreader сам показывает в записи. Берём отрисованный адрес (currentSrc/src),
  // а не исходный адрес на Tumblr: у удалённого поста он отдаёт заглушку.
  // Images Inoreader itself renders in the entry. Use the rendered URL (currentSrc/src), not the
  // original Tumblr URL, which serves a "removed" placeholder for deleted posts.
  function nativeImages(fc) {
    const urls = [];
    for (const img of fc.querySelectorAll(':scope > :not(.tmx-box):not(.tmx-skip) img')) {
      const u = img.currentSrc || img.src;
      if (!u || u.startsWith('data:') || /fetch_icon|favicon|emoji|avatar/i.test(u)) continue;
      if (img.complete && img.naturalWidth && img.naturalWidth < 120) continue;
      urls.push(u);
    }
    return uniq(urls);
  }

  // ---------- Блок с фото / Photo block ----------
  // запись → { postUrl, status: 'loading' | 'ok' | 'err', urls, native }
  // entry → { postUrl, status: 'loading' | 'ok' | 'err', urls, native }
  const state = new WeakMap();

  function makeButton(text, extraClass, onClick) {
    const b = document.createElement('button');
    b.type = 'button';
    b.className = 'tmx-btn ' + extraClass;
    b.textContent = text;
    b.addEventListener('click', (e) => { e.preventDefault(); e.stopPropagation(); onClick(b); });
    return b;
  }

  function renderPhotos(box, st, urls) {
    box.textContent = '';
    urls.forEach((u, i) => {
      const item = document.createElement('div');
      item.className = 'tmx-item';
      // Без ссылки-обёртки: долгий тап даёт обычное меню картинки («Сохранить изображение»).
      // No wrapping link, so a long press shows the regular image menu ("Save image").
      const img = document.createElement('img');
      img.referrerPolicy = 'no-referrer';
      img.decoding = 'async';
      img.alt = '';
      if (i === 0) img.fetchPriority = 'high'; else img.loading = 'lazy';
      const meta = document.createElement('div');
      meta.className = 'tmx-meta';
      img.addEventListener('load', () => { meta.textContent = img.naturalWidth + ' × ' + img.naturalHeight; }, { once: true });
      img.addEventListener('error', () => { meta.textContent = 'картинка не загрузилась'; }, { once: true });
      img.src = u;
      item.append(img, meta);
      if (urls.length > 1) {
        item.appendChild(makeButton('💾 Только это', 'tmx-small', async (b) => {
          b.disabled = true;
          const ok = await saveImage(u, st.postUrl, i);
          b.disabled = false;
          toast(ok ? 'Сохранено' : 'Не удалось — открыл картинку во вкладке');
        }));
      }
      box.appendChild(item);
    });
  }

  function buildBox(art, fc) {
    const postUrl = linkOf(art);
    if (!postUrl) return;

    const box = document.createElement('div');
    box.className = 'tmx-box';
    // Inoreader вешает действия на mouseup — не даём им срабатывать от тапов внутри блока.
    // Inoreader acts on mouseup; keep taps inside the block from reaching it.
    box.addEventListener('mouseup', (e) => e.stopPropagation());
    fc.classList.add('tmx-photo');
    fc.appendChild(box);

    const st = { postUrl, status: 'loading', urls: [], native: false };
    state.set(art, st);

    const titleFallback = () => setCaption(postUrl, art.querySelector('.article_header_title')?.textContent, true);

    const load = async () => {
      updateFab();
      const msg = document.createElement('div');
      msg.className = 'tmx-msg';
      msg.textContent = 'Загружаю фото…';
      box.appendChild(msg);

      try {
        const urls = await getPhotos(postUrl);
        if (!box.isConnected) return;
        titleFallback();
        st.urls = urls;
        st.status = 'ok';
        renderPhotos(box, st, urls);
      } catch {
        if (!box.isConnected) return;
        // Пост удалён или недоступен: убираем свой блок и показываем запись так, как её показывает
        // сам Inoreader. Невидимая метка не даёт скрипту снова взяться за эту запись.
        // Post deleted or unavailable: remove our block and show the entry the way Inoreader does.
        // An invisible marker stops the script from picking this entry up again.
        const skip = document.createElement('i');
        skip.className = 'tmx-skip';
        box.replaceWith(skip);
        fc.classList.remove('tmx-photo');
        const native = nativeImages(fc);
        if (native.length) {
          // Синяя кнопка сохранит то, что видно на экране. / The main button saves what is on screen.
          titleFallback();
          st.urls = native;
          st.native = true;
          st.status = 'ok';
        } else {
          // Синяя кнопка станет «открыть пост». / The main button turns into "open post".
          st.status = 'err';
        }
      }
      updateFab();
    };
    load();
  }

  function preload(art) {
    let n = art;
    for (let i = 0; i < PRELOAD; i++) {
      n = nextArticle(n);
      if (!n) break;
      const url = linkOf(n);
      if (!url) continue;
      getPhotos(url).then((urls) => {
        if (!urls[0]) return;
        const im = new Image();
        im.referrerPolicy = 'no-referrer';
        im.decoding = 'async';
        im.src = urls[0];
      }, () => { /* ошибка покажется при открытии / shown when the entry is opened */ });
    }
  }

  // ---------- Плавающие кнопки / Floating buttons ----------
  let fab = null;
  let fabMain = null;
  let busy = false;

  const icon = (cls, paths) =>
    `<svg class="${cls}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" ` +
    `stroke-linecap="round" stroke-linejoin="round">${paths}</svg>`;

  // Режим «сохранить»: фото-папка и фото удалось получить (или ещё грузится).
  // "Save" mode: a photo folder and the photo was fetched (or is still loading).
  const photoMode = (art) => isPhotoArt(art) && state.get(art)?.status !== 'err';

  async function onMainTap() {
    const art = currentOpen();
    if (!art) return;
    if (!photoMode(art)) {
      // Обычные ленты: открыть пост в новой вкладке, как тап по заголовку.
      // Regular feeds: open the post in a new tab, like tapping the title.
      const url = linkOf(art);
      if (!url) { toast('У записи нет ссылки'); return; }
      if (!window.open(url, '_blank')) art.querySelector('a[id^="burl_"]')?.click();
      return;
    }
    const st = state.get(art);
    if (busy || !st || st.status !== 'ok') return;
    busy = true;
    updateFab();
    try {
      const ok = await saveAll(st);
      if (ok) goNext(art);
      else toast('Не удалось сохранить — открыл картинку во вкладке');
    } finally {
      busy = false;
      updateFab();
    }
  }

  function onNextTap() {
    const art = currentOpen();
    if (art) goNext(art); else goFirst();
  }

  function ensureFab() {
    if (fab) return;
    fab = document.createElement('div');
    fab.className = 'tmx-fab';
    fab.addEventListener('mouseup', (e) => e.stopPropagation());
    const add = (cls, label, html, onClick) => {
      const b = document.createElement('button');
      b.type = 'button';
      b.className = cls;
      b.setAttribute('aria-label', label);
      b.innerHTML = html;
      b.addEventListener('click', (e) => { e.preventDefault(); e.stopPropagation(); onClick(); });
      fab.appendChild(b);
      return b;
    };
    fabMain = add('tmx-fab-save', 'Сохранить и дальше / открыть пост',
      icon('tmx-ic-save', '<path d="M12 4v11"/><path d="M7 11l5 5 5-5"/><path d="M5 20h14"/>') +
      icon('tmx-ic-open', '<path d="M14 4h6v6"/><path d="M20 4l-9 9"/><path d="M18 14v5a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1h5"/>'),
      onMainTap);
    add('tmx-fab-skip', 'Следующая запись', icon('', '<path d="M5 12h14"/><path d="M13 6l6 6-6 6"/>'), onNextTap);
    document.body.appendChild(fab);
  }

  function updateFab() {
    ensureFab();
    setDisplay(fab, document.querySelector('.ar') ? 'flex' : 'none');
    const art = currentOpen();
    const photo = photoMode(art);
    fabMain.classList.toggle('tmx-normal', !photo);
    let disabled = true;
    if (art && photo) {
      const st = state.get(art);
      disabled = busy || !st || st.status !== 'ok';
    } else if (art) {
      disabled = !linkOf(art);
    }
    setDisabled(fabMain, disabled);
  }

  // ---------- Слежение за страницей / Page watching ----------
  function scan() {
    for (const fc of document.querySelectorAll('.ar > .article_full_contents')) {
      if (!fcIsOpen(fc)) continue;
      const art = fc.parentElement;
      if (!isPhotoArt(art) || fc.querySelector(':scope > .tmx-box, :scope > .tmx-skip')) continue;
      buildBox(art, fc);
      preload(art);
    }
    updateFab();
  }

  let scanTimer = 0;
  const scheduleScan = () => {
    if (scanTimer) return;
    scanTimer = setTimeout(() => {
      scanTimer = 0;
      try { scan(); } catch (e) { logError('scan :: ' + e.message); }
    }, SCAN_DELAY);
  };
  // style нужен, чтобы заметить раскрытие записи (Inoreader меняет display у её тела).
  // style is watched to notice an entry opening (Inoreader toggles display on its body).
  new MutationObserver(scheduleScan).observe(document.body, {
    childList: true, subtree: true, attributes: true, attributeFilter: ['style'],
  });
  scan();

  // ---------- Тап по заголовку в фото-папке / Title tap in a photo folder ----------
  if (TITLE_TAP_NEXT) {
    document.addEventListener('click', (e) => {
      if (!e.isTrusted) return;
      const art = e.target.closest?.('a[id^="burl_"]')?.closest('.ar');
      if (!art || !isOpen(art) || !isPhotoArt(art)) return;
      setTimeout(() => goNext(art), 200);
    }, true);
  }

  // ---------- Диагностика / Diagnostics ----------
  GM_registerMenuCommand('Скопировать диагностику / Copy diagnostics', () => {
    const art = currentOpen() || document.querySelector('.ar');
    const text = 'ERRORS:\n' + errors.join('\n') + '\n\nHTML:\n' +
      (art ? art.outerHTML.slice(0, 20000) : 'запись не найдена / no entry found');
    GM_setClipboard(text);
    toast('Диагностика скопирована');
  });
})();
