# Tamper-scripts

[![CI](https://github.com/Rolarn/Tamper-scripts/actions/workflows/ci.yml/badge.svg)](https://github.com/Rolarn/Tamper-scripts/actions/workflows/ci.yml)
[![License: MIT](https://img.shields.io/badge/license-MIT-blue.svg)](LICENSE)

Юзерскрипты для [Tampermonkey](https://www.tampermonkey.net/), которыми я пользуюсь сам. Проверяются на Firefox для Android, работают и в десктопных браузерах.

*Userscripts for Tampermonkey that I use myself. Tested on Firefox for Android, work on desktop too. English summaries are in each script's README.*

## Скрипты / Scripts

| Скрипт | Что делает | Версия | Установка |
|---|---|---|---|
| [Inoreader: фото прямо в ленте](scripts/inoreader-photo-inline) | Фото из поста прямо в Inoreader, кнопки «сохранить и дальше», «открыть пост», «следующая запись» | 2.0.0 | [⬇ Установить](https://raw.githubusercontent.com/Rolarn/Tamper-scripts/main/scripts/inoreader-photo-inline/inoreader-photo-inline.user.js) |
| [Громкость плееров: всегда 100%](scripts/media-volume-max) | Не даёт сайтам занижать громкость видео и аудио | 2.0.0 | [⬇ Установить](https://raw.githubusercontent.com/Rolarn/Tamper-scripts/main/scripts/media-volume-max/media-volume-max.user.js) |

## Установка / Install

1. Установите расширение Tampermonkey (Firefox, в том числе для Android, Chrome, Edge).
2. Нажмите «⬇ Установить» у нужного скрипта — Tampermonkey откроет страницу установки.
3. Подтвердите установку.

## Обновления / Updates

Скрипты обновляются автоматически: Tampermonkey периодически скачивает маленький файл `*.meta.js` (только заголовок) и, если `@version` выросла, ставит новую версию. Проверить вручную: меню Tampermonkey → *Утилиты* → *Проверить обновления*.

Изменения в настройках внутри файла скрипта перезаписываются при обновлении — см. README конкретного скрипта.

## Сообщить о проблеме / Report a problem

[Создайте issue](https://github.com/Rolarn/Tamper-scripts/issues/new/choose): браузер, версия скрипта, адрес страницы, что ожидали и что произошло.

## Разработка / Development

Нужен Node.js 22+.

```sh
npm ci
npm run check      # линтер + проверка заголовков + тесты / lint + header check + tests
npm run meta       # пересобрать *.meta.js после изменения заголовка / rebuild *.meta.js
```

Структура / Layout:

```
scripts/<id>/<id>.user.js   скрипт / the script
scripts/<id>/<id>.meta.js   заголовок для проверки обновлений (генерируется) / update header (generated)
scripts/<id>/README.md      описание и настройки / docs and settings
scripts/<id>/CHANGELOG.md   история версий / version history
test/<id>.test.js           тесты на jsdom / jsdom tests
tools/meta.mjs              генерация .meta.js и проверка заголовков / meta generation and header checks
```

Правила / Rules:

- Версии — [SemVer](https://semver.org/lang/ru/): исправление — patch, новая возможность — minor, несовместимое изменение — major.
- Любое изменение скрипта = новая `@version` + запись в его `CHANGELOG.md` + `npm run meta`. CI это проверяет.
- `@name` и `@namespace` не менять: для Tampermonkey это идентификатор скрипта, смена = новый скрипт у всех пользователей.

## Лицензия / License

[MIT](LICENSE) © Rolarn
