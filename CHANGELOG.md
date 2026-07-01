# Changelog

## [0.8.0] - 2026-07-01

### Added

- Нативный диалог выбора папки с музыкой: клик по иконке папки в статус-баре
  открывает GTK-диалог. Выбранная папка сохраняется в настройках и
  восстанавливается при следующем запуске.
  - Новое IPC: `selectFolder()`, `setMusicFolder(path)`
  - Новое поле `musicFolder` в `SavedState`

### Fixed

- G_CONNECT_SWAPPED в GTK-диалоге — падение при выборе папки.

## [0.8.2] - 2026-07-01

### Added

- i18n: 19 новых языков (uk, es, es-MX, fr, de, it, pt, pt-BR, zh, zh-TW,
  ja, ko, tr, hi, id, vi, pl, cs, el).
- i18n: поддержка региональных вариантов (es-MX, pt-BR, zh-TW).
- i18n: автоматическая загрузка всех .json через Vite import.meta.glob.

### Fixed

- GTK-диалог выбора папки переведён на современный API GtkFileDialog
  (устранены предупреждения о deprecated GtkFileChooserNative).

## Unreleased

## [0.7.3] - 2026-06-26

### Fixed

- Аудио-URL: пути с `#` (фрагмент-разделитель) или пробелами теперь корректно
  percent-кодируются через `g_uri_escape_string` перед передачей в JS.
  ResourceServer уже декодирует через `g_uri_unescape_string` — round-trip
  работает для любых спецсимволов в именах файлов.

## [0.7.2] - 2026-06-26

### Fixed

- Тосты: исправлен белый фон с чёрным текстом. Добавлены цветные фоны:
  - error — красный оттенок
  - warning — жёлтый оттенок
  - info — голубой оттенок
  - success — оранжевый оттенок (primary)
- Тосты теперь показываются при ошибке воспроизведения трека (onAudioEvent type=error)

## [0.7.1] - 2025-01-01

### Changed

- Initial release (placeholder)
