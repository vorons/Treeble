cmake_minimum_required(VERSION 3.21)
project(treeble LANGUAGES CXX VERSION 0.1.0)

# ── C++23 ──────────────────────────────────────────────────────────────────
set(CMAKE_CXX_STANDARD 23)
set(CMAKE_CXX_STANDARD_REQUIRED ON)
set(CMAKE_CXX_EXTENSIONS OFF)

# ── Dependencies ────────────────────────────────────────────────────────────
include(FetchContent)

FetchContent_Declare(
  saucer
  GIT_REPOSITORY "https://github.com/saucer/saucer"
  GIT_TAG        v8.0.4
)
FetchContent_MakeAvailable(saucer)

find_package(PkgConfig REQUIRED)
pkg_check_modules(TAGLIB taglib REQUIRED IMPORTED_TARGET)
pkg_check_modules(GIO gio-unix-2.0 REQUIRED IMPORTED_TARGET)
pkg_check_modules(LIBSOUP libsoup-3.0 REQUIRED IMPORTED_TARGET)
pkg_check_modules(DBUSMENU dbusmenu-glib-0.4 REQUIRED IMPORTED_TARGET)

# ── Frontend build (Vite) ──────────────────────────────────────────────────
set(FRONTEND_DIR "${CMAKE_SOURCE_DIR}/frontend")
set(FRONTEND_DIST "${FRONTEND_DIR}/dist")

find_program(NPM npm REQUIRED)

# Install JS dependencies (skipped if already present)
if(NOT EXISTS "${FRONTEND_DIR}/node_modules")
  execute_process(
    COMMAND "${NPM}" install
    WORKING_DIRECTORY "${FRONTEND_DIR}"
  )
endif()

# Reconfigure cmake whenever frontend sources change,
# so saucer_embed re-embeds the latest dist files
set_property(
  DIRECTORY APPEND
  PROPERTY CMAKE_CONFIGURE_DEPENDS "${FRONTEND_DIR}/src"
)

# Build frontend at configure time (needed by saucer_embed below)
execute_process(
  COMMAND "${NPM}" run build
  WORKING_DIRECTORY "${FRONTEND_DIR}"
)

# Also build frontend at build time when sources change
add_custom_target(frontend ALL
  COMMAND "${NPM}" run build
  WORKING_DIRECTORY "${FRONTEND_DIR}"
  BYPRODUCTS "${FRONTEND_DIST}/index.html"
  COMMENT "Building frontend (Vite)"
)

# ── Sources ────────────────────────────────────────────────────────────────
set(SOURCES
  src/main.cpp
  src/ipc/IPCHandler.cpp
  src/fs/FileScanner.cpp
  src/metadata/TagReader.cpp
  src/audio/WebViewAudioBackend.cpp
  src/web/ResourceServer.cpp
  src/mpris/MPRIS2.cpp
  src/tray/SystemTray.cpp
)

add_executable(treeble ${SOURCES})
add_dependencies(treeble frontend)

target_include_directories(treeble PRIVATE src)

# libsoup-3.0 include dirs (PkgConfig::LIBSOUP doesn't always auto-add)
target_include_directories(treeble PRIVATE ${LIBSOUP_INCLUDE_DIRS})
target_link_directories(treeble PRIVATE ${LIBSOUP_LIBRARY_DIRS})

# ── Embed frontend assets (after target exists) ─────────────────────────────
saucer_embed("${FRONTEND_DIST}" TARGET treeble)

target_link_libraries(treeble PRIVATE
  saucer::saucer
  saucer::embedded
  PkgConfig::TAGLIB
  PkgConfig::GIO
  PkgConfig::LIBSOUP
  PkgConfig::DBUSMENU
)

target_compile_features(treeble PRIVATE cxx_std_23)
