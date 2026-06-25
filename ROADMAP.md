# Roadmap

Цель — **релиз 1.0**: минималистичный, но законченный музыкальный плеер для Linux,
который можно установить из AppImage и пользоваться без доработок.

Актуально на текущий коммит (0.6.0-dev)

---

## 1.0 — Блокеры

### 1. AppImage-пайплайн

**Статус:** ❌ Не реализовано
**Приоритет:** 🔴 Высокий

**Что:** Сборка бинарника + ассетов в единый `.AppImage` файл.

**Описание в `description.md`:**
> Распространение: AppImage. Бинарник + ассеты упаковываются в один .AppImage файл. Зависимости: WebKitGTK не бандлится внутрь, а берётся из системы пользователя.

**Что нужно:**
- linuxdeploy или appimagetool в CI
- `.desktop` файл (см. следующий пункт)
- иконка приложения (PNG 256×256, векторная запакована в бинарник)
- `AppRun` (или entry point)
- CI-скрипт, который запускается после `cmake --build`

**Файлы:**
- `Makefile` или `scripts/package-appimage.sh`
- `.github/workflows/release.yml`
- `treeble.desktop` (см. пункт 2)

---

### 2. `.desktop` файл + иконка приложения

**Статус:** ❌ Не реализовано
**Приоритет:** 🔴 Высокий

**Что:** Стандартный `.desktop` файл для внесения в меню приложений и
иконка для панели/таскбара.

**Требования:**
- `treeble.desktop` с категориями `AudioVideo;Player;`
- Иконка минимум 256×256 PNG (можно сгенерировать из векторной в CI)
- Иконка должна быть видна в `.desktop` и в AppImage
- `MimeType=audio/mpeg;audio/flac;audio/ogg;audio/wav;audio/mp4;`

**Пример:**
```desktop
[Desktop Entry]
Type=Application
Name=Treeble
Comment=Folder-first music player for Linux
Exec=treeble
Icon=treeble
Categories=AudioVideo;Player;
MimeType=audio/mpeg;audio/flac;audio/ogg;audio/wav;audio/mp4;
Terminal=false
StartupNotify=true
Actions=PlayPause;

[Desktop Action PlayPause]
Name=Play / Pause
Exec=treeble --toggle-pause
```

---

### 3. MPRIS2 Next/Previous — реализовать

**Статус:** ✅ Реализовано
**Приоритет:** 🔴 Высокий

**Проблема:** D-Bus методы `Next` и `Previous` в `org.mpris.MediaPlayer2.Player`
— no-op. Любой вызов `playerctl next`, медиа-клавиша на гарнитуре или
KDE Connect не переключают трек. MPRIS2 теряет практический смысл.

**Решение:**
- `MPRIS2` теперь принимает `saucer::smartview &` для вызова JS в WebView.
- `Next`/`Previous` вызывают глобальные JS-функции `__treeble_next()` /
  `__treeble_prev()`, которые делегируют в Zustand store (`usePlayerStore`),
  где уже реализована вся логика навигации по очереди (repeat/shuffle).

**Изменённые файлы:**
- `src/mpris/MPRIS2.h` — добавлен параметр `saucer::smartview &webview`
- `src/mpris/MPRIS2.cpp` — Next/Previous: `base.execute("__treeble_next()")`
- `src/main.cpp` — передача `*webview` в MPRIS2
- `frontend/src/App.tsx` — установка `window.__treeble_next/prev`
- `frontend/src/lib/ipc.ts` — TS-декларации для глобалов

**Сложность:** S

---

### 4. `--version` и парсинг аргументов командной строки

**Статус:** ✅ Реализовано
**Приоритет:** 🟡 Средний

**Что:** Релизный бинарник умеет:
- `treeble --version` → `Treeble 0.6.0`
- `treeble --help` → краткая справка
- `treeble --toggle-pause` → отправляет D-Bus PlayPause на запущенный экземпляр

**Файл:** `src/main.cpp`

**Решение:**
- Версия берётся из CMake (`project(... VERSION 0.6.0)`) через
  `target_compile_definitions` → макрос `TREEBLE_VERSION`.
- Аргументы парсятся до создания `saucer::application`, чтобы CLI-режимы
  работали без GUI.
- `--toggle-pause` использует `g_dbus_connection_call_sync` для вызова
  MPRIS2 PlayPause.

---

## 1.0 — Важные улучшения

### 5. FileScanner: кэширование списка треков

**Статус:** ⚠️ Частично
**Приоритет:** 🟡 Средний

**Проблема:** `list_audio()` читает директорию с диска при каждом клике
на папку. Без кэша переключение между папками — лишний I/O.

**Описание в `description.md`:**
> Содержимое папок (треки) грузится лениво при клике и кэшируется
> в `std::unordered_map`.

`FileScanner.cpp:36` содержит `ponytail:`-комментарий, что кэш не реализован.

**Что нужно:**
```cpp
// Примерный интерфейс
class FileScanner {
    // В дополнение к существующим методам
    void invalidate_cache(const std::string &dir);
private:
    std::unordered_map<std::string, std::vector<std::string>> m_cache;
};
```

**Сложность:** XS (< 20 строк)

---

### 6. SIGTERM/SIGINT: сохранение состояния при завершении

**Статус:** ✅ Реализовано
**Приоритет:** 🟡 Средний

**Проблема:** Если убить процесс через `kill`, `systemctl --user stop` или
завершить сессию, `saveStateOnExit()` не вызывался — терялась позиция окна,
последний трек, громкость.

**Решение:**
- Глобальные указатели `g_ipc` и `g_app` устанавливаются в `start()`.
- Сигнальный хендлер `handle_signal()` вызывает `saveStateOnExit()` и `app->quit()`.
- Сигналы регистрируются в `main()` после парсинга CLI-аргументов.

**Сложность:** XS (~15 строк)

---

### 7. Защита state.json от коррупции

**Статус:** ❌ Не реализовано
**Приоритет:** 🟡 Средний

**Проблема:** При краше посередине `saveState()` (запись через
`std::ofstream`) файл остаётся битым. При следующем старте
`parse_state()` может упасть на `std::from_chars` или вернуть мусор.

**Что нужно:**
- Писать во временный файл, затем атомарно переименовывать
  (`rename()` на той же файловой системе)
- Или: обернуть `loadState` в try-catch, при ошибке возвращать
  дефолтное состояние и удалять битый файл

**Сложность:** XS (~15 строк)

---

### 8. Smoke-тест

**Статус:** ❌ Не реализовано
**Приоритет:** 🟡 Средний

**Что:** Простейший тест, который можно запустить без дисплея:
- Бинарник не падает при `--help` / `--version`
- Бинарник не падает при запуске с указанием корня
- (Опционально) MPRIS2 объект регистрируется на шине

**Формат:** Скрипт `tests/smoke.sh`, который CI запускает после сборки.

**Сложность:** S (~30 строк bash)

---

## После 1.0 (будущие направления)

| Идея | Описание |
|---|---|
| **GStreamerAudioBackend** | Нативный аудиобэкенд в обход WebView — меньше latency, точнее seek, аппаратная поддержка кодеков. Описан в `description.md` как «будущая реализация». |
| **Пакеты для дистрибутивов** | `rpm` (COPR), `deb` (PPA), `flatpak` |
| **Горячие клавиши** | Настраиваемые шорткаты, медиа-клавиши клавиатуры (XF86Audio*) |
| **Загрузка по сети** | SMB/NFS шары как источник музыки |
| **Масштабирование обложек** | Пока игнорируются, но можно показывать из тегов |

---

## Приоритеты к релизу

```
Блокеры (1–3) → Версия (4) → Надёжность (5–7) → Тест (8)
```

Каждый пункт 5–8 можно делать параллельно с любым из 1–4.
