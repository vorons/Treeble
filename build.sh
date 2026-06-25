#!/usr/bin/env bash
set -euo pipefail

cd "$(dirname "$0")"

export PKG_CONFIG_PATH="${HOME}/.local/lib/pkgconfig:/usr/lib64/pkgconfig"
export LIBRARY_PATH="${HOME}/.local/lib:/usr/lib64"
export LD_LIBRARY_PATH="${HOME}/.local/lib:/usr/lib64"

APPIMAGE="${1:-}"  # pass any value (e.g. "--appimage") to also package AppImage

cmake -B build -G Ninja -DCMAKE_BUILD_TYPE=Release
cmake --build build -j"$(nproc)"
echo "→ Built: build/treeble"

if [ -n "$APPIMAGE" ]; then
  echo "→ Packaging AppImage …"
  bash scripts/package-appimage.sh
  echo "→ AppImage ready: build/Treeble-x86_64.AppImage"
fi
