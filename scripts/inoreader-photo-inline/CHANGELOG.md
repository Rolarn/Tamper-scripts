# Changelog — Inoreader: inline photos & quick navigation

Формат — [Keep a Changelog](https://keepachangelog.com/ru/1.1.0/), версии — [SemVer](https://semver.org/lang/ru/).
Format: Keep a Changelog; versioning: SemVer.

## [2.0.0] — 2026-11-13

### Изменено / Changed
- Скрипт переехал в репозиторий и обновляется из него автоматически (`@updateURL` / `@downloadURL`).
  The script now lives in this repository and updates from it automatically.
- **Новый `@namespace` и `@name`**: Tampermonkey считает это другим скриптом — старую копию (1.x) удалите вручную.
  **New `@namespace` and `@name`**: Tampermonkey treats it as a different script — remove the old 1.x copy manually.
- Название и описание на английском и русском (`@name:ru`), комментарии в коде на двух языках.
  Bilingual name/description and code comments.
- Добавлены `@author`, `@license MIT`, `@homepageURL`, `@supportURL`, `@noframes`.

### Удалено / Removed
- Неиспользуемые стили кнопок «Повторить» / «Открыть пост» внутри записи (заменены в 1.5).
  Unused in-entry "Retry" / "Open post" button styles (superseded in 1.5).

## [1.5.0] — 2026-11-13
### Изменено / Changed
- Если фото поста получить не удалось, скрипт убирает свой блок и показывает запись так, как её показывает Inoreader; синяя кнопка сохраняет отрисованное превью или становится «открыть пост».
  If the post photo cannot be fetched, the entry is shown natively; the main button saves the rendered preview or turns into "open post".

## [1.4.0] — 2026-11-13
### Изменено / Changed
- Полная переработка: ограниченный кэш, безопасная разблокировка кнопки, наблюдатель только за раскрытием записей, приоритеты загрузки картинок.
  Rewrite: bounded cache, safe button unlocking, observer limited to entry expansion, image fetch priorities.

## [1.3.0] — 2026-11-12
### Добавлено / Added
- Имя файла из подписи под фото + короткий номер поста. / File name from the photo caption + short post id.

## [1.2.0] — 2026-11-12
### Добавлено / Added
- Кнопки во всём Inoreader; в обычных лентах первая кнопка открывает пост. / Buttons everywhere; in regular feeds the main button opens the post.

## [1.1.0] — 2026-11-12
### Изменено / Changed
- Плавающие круглые кнопки вместо кнопок под фото; исходное имя файла. / Floating round buttons; original file name.

## [1.0.0] — 2026-11-11
### Добавлено / Added
- Первая версия: фото из поста Tumblr прямо в Inoreader, «сохранить и дальше». / First release.
