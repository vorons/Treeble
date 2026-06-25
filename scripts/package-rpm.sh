#!/usr/bin/env bash
# package-rpm.sh — Build Treeble .rpm package
# Depends: rpmbuild (from rpm package on Ubuntu, rpm-build on Fedora)
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
PROJECT_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"
BUILD_DIR="${PROJECT_DIR}/build"
STAGING="$(mktemp -d)"
trap 'rm -rf "$STAGING"' EXIT

VERSION="${VERSION:-$(cd "$PROJECT_DIR"; git describe --tags --always 2>/dev/null || echo "0.0.0")}"
VERSION="${VERSION#v}"
RELEASE="1"

ARCH="x86_64"

# Build rpm tree
RPM_DIR="${STAGING}/rpmbuild"
mkdir -p "${RPM_DIR}"/{BUILD,RPMS,SOURCES,SPECS,SRPMS}

# Inject binary into SOURCES so rpmbuild can find it
cp "${BUILD_DIR}/treeble" "${RPM_DIR}/SOURCES/"

cat > "${RPM_DIR}/SPECS/treeble.spec" <<EOF
Name:       treeble
Version:    ${VERSION}
Release:    ${RELEASE}%{?dist}
Summary:    Folder-first music player for Linux
License:    MIT
URL:        https://github.com/alex2844/Treeble
Source0:    treeble
BuildArch:  ${ARCH}

%description
Folder-first music player for Linux.

%install
install -m755 -d %{buildroot}%{_bindir}
install -m755 -d %{buildroot}%{_datadir}/applications
install -m755 -d %{buildroot}%{_datadir}/icons/hicolor/256x256/apps
install -m755 %{SOURCE0} %{buildroot}%{_bindir}/treeble
install -m644 ${PROJECT_DIR}/treeble.desktop %{buildroot}%{_datadir}/applications/
install -m644 ${PROJECT_DIR}/assets/treeble.png %{buildroot}%{_datadir}/icons/hicolor/256x256/apps/

%files
%{_bindir}/treeble
%{_datadir}/applications/treeble.desktop
%{_datadir}/icons/hicolor/256x256/apps/treeble.png

%changelog
* $(date '+%a %b %d %Y') Alexey Kuznetsov <alex@example.com> - ${VERSION}-${RELEASE}
- Initial package
EOF

rpmbuild -bb \
  --define "_topdir ${RPM_DIR}" \
  --define "_builddir ${RPM_DIR}/BUILD" \
  --define "_rpmdir ${RPM_DIR}/RPMS" \
  --define "_sourcedir ${RPM_DIR}/SOURCES" \
  --define "_specdir ${RPM_DIR}/SPECS" \
  --define "_srcrpmdir ${RPM_DIR}/SRPMS" \
  "${RPM_DIR}/SPECS/treeble.spec"

# Copy resulting rpm to build dir
cp "${RPM_DIR}/RPMS/${ARCH}/treeble-${VERSION}-${RELEASE}.${ARCH}.rpm" \
   "${BUILD_DIR}/treeble-${VERSION}-${RELEASE}.${ARCH}.rpm"

echo ":: Done: ${BUILD_DIR}/treeble-${VERSION}-${RELEASE}.${ARCH}.rpm"
