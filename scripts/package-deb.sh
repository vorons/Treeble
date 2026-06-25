#!/usr/bin/env bash
# package-deb.sh — Build Treeble .deb package
# Depends: dpkg-deb, fakeroot
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
PROJECT_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"
BUILD_DIR="${PROJECT_DIR}/build"
STAGING="$(mktemp -d)"
trap 'rm -rf "$STAGING"' EXIT

VERSION="${VERSION:-$(cd "$PROJECT_DIR"; git describe --tags --always 2>/dev/null || echo "0.0.0")}"
VERSION="${VERSION#v}"

ARCH="amd64"
PKG_DIR="${STAGING}/treeble_${VERSION}_${ARCH}"

mkdir -p "${PKG_DIR}/DEBIAN" \
         "${PKG_DIR}/usr/bin" \
         "${PKG_DIR}/usr/share/applications" \
         "${PKG_DIR}/usr/share/icons/hicolor/256x256/apps"

install -m755 "${BUILD_DIR}/treeble" "${PKG_DIR}/usr/bin/"
install -m644 "${PROJECT_DIR}/treeble.desktop" "${PKG_DIR}/usr/share/applications/"
install -m644 "${PROJECT_DIR}/assets/treeble.png" \
  "${PKG_DIR}/usr/share/icons/hicolor/256x256/apps/"

# Auto-detect shared library dependencies
SHLIBS=""
if command -v dpkg-shlibdeps &>/dev/null; then
  SHLIBS=$(dpkg-shlibdeps -O "${PKG_DIR}/usr/bin/treeble" 2>/dev/null | sed "s/^shlibs:Depends=//" || true)
fi
: "${SHLIBS:=libc6 (>= 2.35)}"

cat > "${PKG_DIR}/DEBIAN/control" <<EOF
Package: treeble
Version: ${VERSION}
Architecture: ${ARCH}
Maintainer: Alexey Kuznetsov
Section: sound
Priority: optional
Description: Folder-first music player for Linux
 Homepage: https://github.com/alex2844/Treeble
Depends: ${SHLIBS}
EOF

fakeroot dpkg-deb --build "${PKG_DIR}" "${BUILD_DIR}/treeble_${VERSION}_${ARCH}.deb"
echo ":: Done: ${BUILD_DIR}/treeble_${VERSION}_${ARCH}.deb"
