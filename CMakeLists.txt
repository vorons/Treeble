cmake_minimum_required(VERSION 3.21)
project(treeble LANGUAGES CXX VERSION 0.7.3)

# ── C++23 ──────────────────────────────────────────────────────────────────
set(CMAKE_CXX_STANDARD 23)
if(NOT CMAKE_BUILD_TYPE)
  set(CMAKE_BUILD_TYPE Release)
endif()
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
  src/tray/SystemTray.cpp
  src/mpris/MPRIS2.cpp
)

add_executable(treeble ${SOURCES})
add_dependencies(treeble frontend)

target_include_directories(treeble PRIVATE src)

# libsoup-3.0 include dirs (PkgConfig::LIBSOUP doesn't always auto-add)
target_include_directories(treeble PRIVATE ${LIBSOUP_INCLUDE_DIRS})
target_link_directories(treeble PRIVATE ${LIBSOUP_LIBRARY_DIRS})

# ── Embed frontend assets (after target exists) ─────────────────────────────
# Clean stale embedded files from previous builds so saucer_embed doesn't
# accumulate orphaned assets with stale hashes
set(EMBED_OUTPUT "${CMAKE_BINARY_DIR}/embedded/saucer/embedded/files")
file(REMOVE_RECURSE "${EMBED_OUTPUT}")

saucer_embed("${FRONTEND_DIST}" TARGET treeble)

target_link_libraries(treeble PRIVATE
  saucer::saucer
  saucer::embedded
  PkgConfig::TAGLIB
  PkgConfig::GIO
  PkgConfig::LIBSOUP
  PkgConfig::DBUSMENU
)

target_compile_definitions(treeble PRIVATE TREEBLE_VERSION="${PROJECT_VERSION}")

target_compile_features(treeble PRIVATE cxx_std_23)

# Strip in Release builds
if(CMAKE_BUILD_TYPE STREQUAL "Release")
  target_link_options(treeble PRIVATE -s)
endif()

# ── Install rules (for AppDir / system) ───────────────────────────────────
install(TARGETS treeble RUNTIME DESTINATION bin)
install(FILES treeble.desktop DESTINATION share/applications)
install(FILES assets/treeble.png DESTINATION share/icons/hicolor/256x256/apps)

# ── Packaging (CPack) ─────────────────────────────────────────────────────
set(CPACK_PACKAGE_NAME "treeble")
set(CPACK_PACKAGE_VERSION "${PROJECT_VERSION}")
set(CPACK_PACKAGE_VENDOR "Treeble")
set(CPACK_PACKAGE_CONTACT "https://github.com/vorons/Treeble")
set(CPACK_PACKAGE_DESCRIPTION_SUMMARY "Folder-first music player for Linux")
set(CPACK_PACKAGE_HOMEPAGE_URL "https://github.com/vorons/Treeble")

set(CPACK_DEBIAN_PACKAGE_MAINTAINER "Alexey Kuznetsov")
set(CPACK_DEBIAN_PACKAGE_SECTION "sound")
set(CPACK_DEBIAN_PACKAGE_PRIORITY "optional")
set(CPACK_DEBIAN_PACKAGE_SHLIBDEPS ON)

set(CPACK_RPM_PACKAGE_GROUP "Audio/Player")
set(CPACK_RPM_PACKAGE_LICENSE "MIT")

set(CPACK_GENERATOR "TGZ;DEB;RPM")

include(CPack)
