# 🎵 Treeble

> Минималистичный музыкальный плеер для Linux — «файловый менеджер для музыки».

## Философия

- **Дерево папок** слева, **список треков** справа.
- **Папка = очередь**. Next/Prev переключают треки внутри текущей папки.
- Никаких БД, плейлистов, обложек, стриминга, скробблинга.
- Только локальные файлы.

## Стек

| Слой | Технология |
|------|-----------|
| Backend | C++23, Saucer (WebKitGTK), TagLib, GDBus |
| Frontend | React + TypeScript + Vite + Tailwind CSS + Zustand |
| IPC | Saucer C++ ↔ JS interop (glaze-сериализация) |
| Сборка | CMake (FetchContent подтягивает Saucer) |

## Сборка

### Требования
- C++23 компилятор (GCC 13+)
- CMake 3.21+
- Node.js 20+
- Системные пакеты:
  - Fedora: `webkit2gtk4.1-devel json-glib-devel taglib-devel glib2-devel gtk4-devel libsoup3-devel`
  - Ubuntu: `libwebkitgtk-6.0-dev libjson-glib-dev libtag1-dev libglib2.0-dev libgtk-4-dev libsoup-3.0-dev`

### Быстрый старт

```bash
./build.sh
./build/treeble
```

Или вручную:
```bash
export PKG_CONFIG_PATH="${HOME}/.local/lib/pkgconfig:/usr/lib64/pkgconfig"
export LIBRARY_PATH="${HOME}/.local/lib:/usr/lib64"
cmake -B build -DCMAKE_BUILD_TYPE=Release
cmake --build build -j$(nproc)
./build/treeble
```

Переменная окружения `TREEBLE_ROOT` указывает корневую папку музыки
(по умолчанию `~/Music`).

## Команды

| Клавиша | Действие |
|---------|----------|
| Двойной клик по треку | Воспроизвести |
| Кнопки в PlayerBar | Play/Pause, Next, Prev, Seek, Volume |

## Управление через MPRIS2 (TODO)

Интеграция с медиа-ключами системы через `org.mpris.MediaPlayer2.treeble`.

## Лицензия

MIT
