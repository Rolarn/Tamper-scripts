# Changelog — Video players: volume 100% & double-tap seek

Формат — [Keep a Changelog](https://keepachangelog.com/ru/1.1.0/), версии — [SemVer](https://semver.org/lang/ru/).
Format: Keep a Changelog; versioning: SemVer.

## [2.6.0] — 2026-11-27

### Добавлено / Added
- Большая кнопка ▶ по центру остановленного видео на сайтах из `CLICK_TO_PLAY_SITES`: тап запускает видео со звуком. Кнопки создаются только для видео на экране. Настройка `BIG_PLAY_BUTTON`.
  Big ▶ button over paused videos on `CLICK_TO_PLAY_SITES`; starts playback with sound. Created only for on-screen videos.

### Исправлено / Fixed
- На reactor.cc видео не запускалось кнопкой встроенного плеера Firefox: её нажатия странице не видны, и скрипт принимал запуск за автозапуск. Теперь видео, которое вы запустили (большой кнопкой, тапом или клавишей), дальше играет и ставится на паузу без вмешательства скрипта; сайт по-прежнему не может запустить видео сам.
  Videos on reactor.cc could not be started with Firefox's built-in play button (its taps are invisible to the page). Videos you started are now left alone afterwards.

## [2.5.0] — 2026-11-26

### Добавлено / Added
- Без автозапуска и со звуком на сайтах из `CLICK_TO_PLAY_SITES` (reactor.cc, joyreactor): атрибуты `autoplay` и `muted` снимаются, любой запуск не сразу после тапа, клика или клавиши ставится на паузу (как в проверенных скриптах click-to-play), выключение звука сайтом отменяется, загружается только начало видео. Нажатие пальца считается действием пользователя только на видео, чтобы прокрутка не разрешала автозапуск.
  No autoplay and sound on for `CLICK_TO_PLAY_SITES` (reactor.cc, joyreactor): `autoplay`/`muted` removed, any start not right after a tap/click/key is paused, site-initiated muting undone, preload limited to metadata.
- Настройки `CLICK_TO_PLAY_SITES`, `GESTURE_WINDOW_MS`.

## [2.4.0] — 2026-11-25

### Добавлено / Added
- Кнопка «▶ MX» для видео, которые сайт собирает в браузере из кусков (адрес `blob:`): скрипт ищет на странице ссылку на скачивание с указанием качества и берёт лучшую не выше `MX_MAX_HEIGHT` (1080p), а если её нет — адрес потока `.m3u8` среди загруженных страницей файлов. Пример — eporner.
  "▶ MX" for `blob:` videos: falls back to the best download link on the page up to `MX_MAX_HEIGHT` (1080p), then to a loaded `.m3u8` stream.
- Настройка `MX_MAX_HEIGHT`.

## [2.3.0] — 2026-11-24

### Добавлено / Added
- Кнопка «▶ MX»: появляется вверху по центру видео на 10 секунд после касания, ставит видео на паузу и открывает его в MX Player с той же позиции и с названием страницы. Не показывается для видео без обычной ссылки (`blob:`), прячется при прокрутке и смене полноэкранного режима.
  "▶ MX" button: shown at the top centre for 10 s after touching a video; pauses it and opens it in MX Player at the same position with the page title. Hidden for videos without a plain URL (`blob:`), on scroll and on fullscreen change.
- Настройки `MX_ENABLED`, `MX_PACKAGE`, `MX_BUTTON_MS`.

## [2.2.0] — 2026-11-24

### Добавлено / Added
- Перемотка горизонтальным свайпом по видео, как в MX Player, в обычном и полноэкранном режиме: не нужно целиться в тонкую полосу прокрутки. Свайп на всю ширину — 2 минуты; во время свайпа видно целевое время, перемотка — при отпускании пальца.
  MX Player-style horizontal swipe seek, inline and in fullscreen — no need to hit the thin progress bar. Full width = 2 min; the target time is shown while swiping, the seek happens on release.
- Настройки `SCRUB_ENABLED`, `SCRUB_FULLSCREEN_ONLY`, `SCRUB_FULL_WIDTH_SEC`.
- В README — совет, как увеличить буфер видео в `about:config` Firefox.
  README tip on raising Firefox's video buffer via `about:config`.

### Изменено / Changed
- Вне полноэкранного режима слушатель `touchmove` пассивный: перемотка свайпом не замедляет прокрутку страницы.
  Outside fullscreen the `touchmove` listener is passive, so swipe seek does not slow page scrolling.

## [2.1.1] — 2026-11-22

### Исправлено / Fixed
- Двойной тап иногда ставил видео на паузу (или запускал его). Плееры принимают первый тап за одиночный и переключают паузу — часто с задержкой 0,2–0,3 с, уже после того, как скрипт вернул воспроизведение. Теперь всю серию тапов и ещё 0,5 с после неё любое изменение паузы/пуска этого видео сразу отменяется. Работает и с плеерами, которые реагируют на само касание.
  Double tap sometimes paused (or started) the video: players toggle on the first tap, often 0.2–0.3 s late, after the script had already restored playback. Now any play/pause change of that video is reverted for the whole series and 0.5 s after it.
- Тап по центру сразу после перемотки (в течение ~1 с) не доходил до плеера. Теперь любое новое касание вне стороны серии сразу работает как обычно.
  A centre tap right after seeking was swallowed for ~1 s; new touches outside the series side now work immediately.

### Изменено / Changed
- Окно продолжения серии — 1 с вместо 0,7 с, как в YouTube. / Series window is 1 s instead of 0.7 s, like YouTube.
- В README добавлены схемы зон касания. / Tap-zone diagrams added to the README.

## [2.1.0] — 2026-11-21

### Добавлено / Added
- Свайпы, как в MX Player: вертикальный свайп по левой половине видео — яркость (10–150%), по правой — громкость (0–100%). По умолчанию только в полноэкранном режиме, чтобы не мешать прокрутке страницы.
  MX Player-style swipes: vertical swipe on the left half of the video = brightness (10–150%), right half = volume (0–100%). Fullscreen only by default so page scrolling is unaffected.
- Настройки `SWIPE_ENABLED`, `SWIPE_FULLSCREEN_ONLY`, `SWIPE_SENSITIVITY`, `BRIGHTNESS_MIN`, `BRIGHTNESS_MAX`.

### Изменено / Changed
- «Громкость 100%» больше не перебивает громкость, выставленную жестом.
  "Volume 100%" no longer overrides a volume set by gesture.

## [2.0.0] — 2026-11-13

### Добавлено / Added
- Перемотка двойным тапом, как в YouTube: правая треть — вперёд, левая — назад, каждый следующий тап добавляет шаг (10 → 20 → 30 с). Центр и панели плеера не затрагиваются; первый тап серии не ставит видео на паузу; двойной тап не включает полный экран и не увеличивает страницу.
  YouTube-style double-tap seek: right third forward, left third back, every further tap adds a step. Player controls are untouched; the first tap does not pause the video; no fullscreen toggle or zoom.
- Настройки `VOLUME_ENABLED`, `SEEK_ENABLED`, `SEEK_STEP`, `SEEK_EXCLUDE`, `SEEK_FULLSCREEN_ONLY`.

### Изменено / Changed
- Скрипт переименован из «Громкость плееров: всегда 100%» (`media-volume-max`) и переехал в репозиторий с автообновлением.
  Renamed from "Media volume: always 100%" (`media-volume-max`); now lives in this repository with auto-update.
- **Новые `@namespace` и `@name`**: Tampermonkey считает это другим скриптом — старую копию (1.x) удалите вручную.
  **New `@namespace` and `@name`**: remove the old 1.x copy manually.
- Добавлены `@author`, `@license MIT`, `@homepageURL`, `@supportURL`; название, описание и комментарии на двух языках.

### Удалено / Removed
- Ключ `@all-frames`: Tampermonkey его не знает, скрипт и так работает во фреймах.
  `@all-frames`: not a Tampermonkey key; the script runs in frames by default.

## [1.2.0] — 2026-11-13
### Исправлено / Fixed
- Плееры KVS (kt_player): громкость поднимается через `localStorage.volume` — именно оттуда плеер её берёт.
  KVS players: volume is raised via `localStorage.volume`, where the player reads it from.

## [1.1.0] — 2026-11-13
### Добавлено / Added
- Попытка подменить стартовую громкость KVS через `flashvars` (не помогло — убрано в 1.2).
  Attempt to patch KVS start volume via `flashvars` (did not help; removed in 1.2).

## [1.0.0] — 2026-11-13
### Добавлено / Added
- Первая версия: громкость `<video>`/`<audio>` выше нуля → 100%. / First release.
