#!/usr/bin/env bash
set -euo pipefail

cd "$(dirname "$0")"

export PKG_CONFIG_PATH="${HOME}/.local/lib/pkgconfig:/usr/lib64/pkgconfig"
export LIBRARY_PATH="${HOME}/.local/lib:/usr/lib64"
export LD_LIBRARY_PATH="${HOME}/.local/lib:/usr/lib64"

cmake -B build -DCMAKE_BUILD_TYPE=Release
cmake --build build -j"$(nproc)"
echo "→ Built: build/treeble"
