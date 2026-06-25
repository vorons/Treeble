#!/usr/bin/env bash
# package-appimage.sh — Build + package Treeble as an AppImage
# Usage: ./scripts/package-appimage.sh [AppDir output-dir]
#
# Dependencies: cmake, ninja (or make), wget, fuse (for appimagetool)
# WebKitGTK is NOT bundled — it is taken from the host system.
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
PROJECT_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"
BUILD_DIR="${PROJECT_DIR}/build"

APP_NAME="Treeble"
ARCH="x86_64"
APPIMAGETOOL="${APPIMAGETOOL:-appimagetool}"

# ── 1. Build ──────────────────────────────────────────────────────────────
echo ":: Building Treeble …"
cmake -S "$PROJECT_DIR" -B "$BUILD_DIR" -G Ninja -DCMAKE_BUILD_TYPE=Release \
  -DCMAKE_CXX_COMPILER=g++-14 \
  -Dsaucer_no_compiler_version_check=ON
cmake --build "$BUILD_DIR" --parallel

# ── 2. Create AppDir ──────────────────────────────────────────────────────
APPDIR="${1:-"${BUILD_DIR}/AppDir"}"
OUTPUT_DIR="${2:-"${BUILD_DIR}"}"
rm -rf "$APPDIR"
mkdir -p "$APPDIR/usr/bin" "$APPDIR/usr/share/applications" \
        "$APPDIR/usr/share/icons/hicolor/256x256/apps"

echo ":: Installing into AppDir …"
# Install only the treeble binary, .desktop, and icon.
# We skip the bloated cmake --install which pulls in all static libs + headers.
install -m755 "${BUILD_DIR}/treeble" "$APPDIR/usr/bin/"
install -m644 "${PROJECT_DIR}/treeble.desktop" "$APPDIR/usr/share/applications/"
install -m644 "${PROJECT_DIR}/assets/treeble.png" \
  "$APPDIR/usr/share/icons/hicolor/256x256/apps/"

# ── 3. Bundle extra shared libraries ─────────────────────────────────────
# These libraries are not guaranteed to be present on every target system,
# so we bundle them inside the AppDir and point to them via LD_LIBRARY_PATH.
mkdir -p "$APPDIR/usr/lib"

# taglib — soname differs between distro versions (libtag.so.1 vs libtag.so.2)
for lib in libtag.so* libtag_c.so* libdbusmenu-glib.so*; do
  found="$(find /usr/lib* /lib* -maxdepth 2 -name "$lib" -print -quit 2>/dev/null || true)"
  if [ -n "$found" ]; then
    cp -aL "$found" "$APPDIR/usr/lib/"
  fi
done

# ── 4. Generate AppRun ────────────────────────────────────────────────────
# AppRun is the entry point; we just forward to the real binary.
cat > "$APPDIR/AppRun" << 'APPRUN'
#!/usr/bin/env bash
HERE="$(cd "$(dirname "$0")" && pwd)"
export LD_LIBRARY_PATH="$HERE/usr/lib:${LD_LIBRARY_PATH:-}"
exec "$HERE/usr/bin/treeble" "$@"
APPRUN
chmod +x "$APPDIR/AppRun"

# ── 5. Root-level files for appimagetool discovery ───────────────────────
# appimagetool requires a .desktop file and icon at the root of the AppDir.
cp "$PROJECT_DIR/treeble.desktop" "$APPDIR/"
cp "$PROJECT_DIR/assets/treeble.png" "$APPDIR/treeble.png"
cp "$APPDIR/treeble.png" "$APPDIR/.DirIcon"

# ── 6. Bundle appimagetool (if not already on PATH) ───────────────────────
if command -v "$APPIMAGETOOL" &>/dev/null; then
  TOOL="$APPIMAGETOOL"
else
  TOOL="${BUILD_DIR}/.appimagetool"
  if [ ! -f "$TOOL" ]; then
    echo ":: Downloading appimagetool …"
    wget -qO "$TOOL" \
      "https://github.com/AppImage/AppImageKit/releases/download/continuous/appimagetool-${ARCH}.AppImage"
    chmod +x "$TOOL"
  fi
  # appimagetool may need FUSE; try --appimage-extract-and-run as a fallback
  if ! "$TOOL" --version &>/dev/null; then
    echo ":: appimagetool needs FUSE, trying --appimage-extract-and-run …"
    # Extract and run manually
    "$TOOL" --appimage-extract >/dev/null 2>&1
    TOOL="${BUILD_DIR}/squashfs-root/AppRun"
  fi
fi

# ── 7. Package ────────────────────────────────────────────────────────────
OUTPUT="${OUTPUT_DIR}/${APP_NAME}-${ARCH}.AppImage"
echo ":: Packaging AppImage → ${OUTPUT} …"

# VERSION + UPDATE_INFO are optional; set VERSION for appstream metadata
export VERSION="${VERSION:-$(cd "$PROJECT_DIR"; git describe --tags --always 2>/dev/null || echo "0.0.0")}"
export ARCH="${ARCH}"

"$TOOL" "$APPDIR" "$OUTPUT"

echo ":: Done: ${OUTPUT}"
