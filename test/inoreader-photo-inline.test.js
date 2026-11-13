// Прогон скрипта на модели страницы Inoreader с поддельной сетью.
// Runs the script against a simulated Inoreader page with a fake network.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { JSDOM } from 'jsdom';

const SRC = await readFile(new URL('../scripts/inoreader-photo-inline/inoreader-photo-inline.user.js', import.meta.url), 'utf8');
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const PHOTO = '{"1":"Photo_Tumblr"}';
const OTHER = '{"2":"IT"}';
const entry = (id, href, tags) => `<div id="article_${id}" class="ar" data-tags='${tags}'>
  <div class="article_header"><div class="article_header_text"><a id="burl_${id}" href="${href}"><span class="article_header_title">Title ${id}</span></a></div></div>
  <div class="article_full_contents" style="display:none"></div></div>`;

function setup() {
  const dom = new JSDOM(`<body><div id="reader_pane">
    ${entry(1, 'https://someblog.tumblr.com/post/831719253556248576', PHOTO)}
    ${entry(2, 'https://gone.tumblr.com/post/111111222222', PHOTO)}
    ${entry(3, 'https://gone.tumblr.com/post/333333444444', PHOTO)}
    ${entry(4, 'https://news.example/x', OTHER)}
    ${entry(5, 'https://news.example/y', OTHER)}
  </div></body>`, { url: 'https://www.inoreader.com/feed/abc', runScripts: 'outside-only', pretendToBeVisual: true });
  const w = dom.window;
  const io = { opened: [], downloads: [], requests: [] };

  w.open = (u) => { io.opened.push(u); return {}; };
  w.URL.createObjectURL = () => 'blob:x';
  w.URL.revokeObjectURL = () => {};
  w.HTMLAnchorElement.prototype.click = function () { if (this.download) io.downloads.push(this.download); };
  w.GM_registerMenuCommand = () => {};
  w.GM_setClipboard = () => {};
  w.GM_xmlhttpRequest = (o) => {
    io.requests.push(o.url);
    setTimeout(() => {
      if (o.responseType === 'blob') return o.onload({ status: 200, response: new w.Blob(['x'], { type: 'image/png' }) });
      if (o.url.includes('someblog.tumblr.com/api')) {
        return o.onload({ status: 200, responseText: 'var tumblr_api_read = ' + JSON.stringify({ posts: [{
          slug: 'ave-estel', 'regular-title': '',
          'regular-body': '<div class="npf_row"><figure><img src="https://64.media.tumblr.com/a/b/s640x960/f.png" ' +
            'srcset="https://64.media.tumblr.com/a/b/s640x960/f.png 640w, https://64.media.tumblr.com/a/b/s1280x1920/f.png 1280w"/>' +
            '</figure></div><p>Ave Estel </p>',
        }] }) + ';' });
      }
      return o.onload({ status: 404, responseText: '' }); // удалённые посты / deleted posts
    }, 5);
  };

  // Модель Inoreader: тап по строке раскрывает запись и сворачивает остальные.
  // Inoreader model: tapping a row expands that entry and collapses the others.
  w.document.addEventListener('mouseup', (e) => {
    const art = e.target.closest('.ar');
    if (!art) return;
    for (const fc of w.document.querySelectorAll('.article_full_contents')) fc.style.display = 'none';
    const fc = art.querySelector('.article_full_contents');
    if (!fc.querySelector('.orig')) {
      // У записи 2 есть превью Inoreader: src — его копия, data-original-src — заглушка Tumblr.
      // Entry 2 has an Inoreader preview: src = Inoreader copy, data-original-src = Tumblr placeholder.
      const preview = art.id === 'article_2'
        ? '<img src="https://www.inoreader.com/camo/abc/prev.jpg" data-original-src="https://64.media.tumblr.com/p/q/s500x750/removed.jpg">'
        : '';
      fc.insertAdjacentHTML('afterbegin', `<div class="orig">toolbar${preview}</div>`);
    }
    fc.style.display = '';
  });

  w.eval(SRC);
  return { w, io, $: (s) => w.document.querySelector(s) };
}

test('Inoreader: полный сценарий / full flow', async (t) => {
  const { w, io, $ } = setup();
  await sleep(200);
  const [main, next] = w.document.querySelectorAll('.tmx-fab button');

  await t.test('кнопки видны, ничего не открыто / buttons visible, nothing open', () => {
    assert.equal($('.tmx-fab').style.display, 'flex');
    assert.equal(main.disabled, true);
  });

  next.click();
  await sleep(400);

  await t.test('берётся самый большой размер / largest size is used', () => {
    assert.match($('#article_1 .tmx-box img').src, /s1280x1920\/f\.png$/);
    assert.equal(main.disabled, false);
    assert.equal(main.classList.contains('tmx-normal'), false);
  });

  await t.test('следующие записи подгружаются заранее / upcoming entries are prefetched', () => {
    assert.ok(io.requests.some((u) => u.includes('gone.tumblr.com')));
  });

  main.click();
  await sleep(500);

  await t.test('имя файла из подписи, затем переход / caption file name, then next entry', () => {
    assert.equal(io.downloads[0], 'Ave Estel_248576.png');
    assert.notEqual($('#article_2 .article_full_contents').style.display, 'none');
  });

  await sleep(300);

  await t.test('удалённый пост: вид Inoreader и сохранение его копии / deleted post: native view, saves Inoreader copy', async () => {
    const fc = $('#article_2 .article_full_contents');
    assert.equal($('#article_2 .tmx-box'), null);
    assert.equal(fc.classList.contains('tmx-photo'), false);
    assert.ok($('#article_2 .orig img'));
    assert.equal(main.disabled, false);
    main.click();
    await sleep(500);
    assert.ok(io.requests.includes('https://www.inoreader.com/camo/abc/prev.jpg'));
    assert.equal(io.downloads[1], 'Title 2_222222.png');
  });

  await sleep(300);

  await t.test('удалённый пост без превью: кнопка «открыть пост» / no preview: main button opens the post', async () => {
    assert.equal($('#article_3 .tmx-box'), null);
    assert.ok($('#article_3 .tmx-skip'));
    assert.equal(main.classList.contains('tmx-normal'), true);
    assert.equal(main.disabled, false);
    await sleep(400);
    assert.equal($('#article_3 .tmx-box'), null, 'скрипт не берётся повторно / not picked up again');
  });

  next.click();
  await sleep(400);

  await t.test('обычная лента: открыть пост без автоперехода / regular feed: open post, no auto-advance', async () => {
    assert.equal($('#article_4 .tmx-box'), null);
    assert.equal(main.classList.contains('tmx-normal'), true);
    main.click();
    await sleep(50);
    assert.equal(io.opened.at(-1), 'https://news.example/x');
    assert.notEqual($('#article_4 .article_full_contents').style.display, 'none');
  });

  await t.test('в покое скрипт не трогает страницу / idle script does not touch the page', async () => {
    let mutations = 0;
    const mo = new w.MutationObserver((list) => { mutations += list.length; });
    mo.observe(w.document.body, { childList: true, subtree: true, attributes: true });
    await sleep(600);
    mo.disconnect();
    assert.equal(mutations, 0);
  });

  w.close();
});
