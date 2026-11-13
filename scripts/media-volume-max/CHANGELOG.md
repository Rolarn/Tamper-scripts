# Changelog — Media volume: always 100%

Формат — [Keep a Changelog](https://keepachangelog.com/ru/1.1.0/), версии — [SemVer](https://semver.org/lang/ru/).
Format: Keep a Changelog; versioning: SemVer.

## [2.0.0] — 2026-11-13

### Изменено / Changed
- Скрипт переехал в репозиторий и обновляется из него автоматически (`@updateURL` / `@downloadURL`).
  The script now lives in this repository and updates from it automatically.
- **Новый `@namespace` и `@name`**: Tampermonkey считает это другим скриптом — старую копию (1.x) удалите вручную.
  **New `@namespace` and `@name`**: Tampermonkey treats it as a different script — remove the old 1.x copy manually.
- Название, описание и комментарии на английском и русском. / Bilingual name, description and comments.
- Добавлены `@author`, `@license MIT`, `@homepageURL`, `@supportURL`.

### Удалено / Removed
- Ключ `@all-frames`: Tampermonkey его не знает, скрипт и так работает во фреймах.
  The `@all-frames` key: Tampermonkey does not support it; the script runs in frames by default.

## [1.2.0] — 2026-11-13
### Исправлено / Fixed
- Плееры KVS (kt_player): громкость поднимается через хранилище сайта (`localStorage.volume`) — именно оттуда плеер её берёт. Найдено диагностикой в браузере.
  KVS players: volume is raised via site storage (`localStorage.volume`), where the player actually reads it from.

## [1.1.0] — 2026-11-13
### Добавлено / Added
- Попытка подменить стартовую громкость KVS через `flashvars` (не помогло — откатено в 1.2).
  Attempt to patch KVS start volume via `flashvars` (did not help; reverted in 1.2).

## [1.0.0] — 2026-11-13
### Добавлено / Added
- Первая версия: громкость `<video>`/`<audio>` выше нуля → 100%. / First release.
