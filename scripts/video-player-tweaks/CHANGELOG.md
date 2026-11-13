# Changelog — Video players: volume 100% & double-tap seek

Формат — [Keep a Changelog](https://keepachangelog.com/ru/1.1.0/), версии — [SemVer](https://semver.org/lang/ru/).
Format: Keep a Changelog; versioning: SemVer.

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
