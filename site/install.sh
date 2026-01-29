#!/usr/bin/env bash
# SaveState installer — https://savestate.dev
# Usage: curl -fsSL https://savestate.dev/install.sh | sh
set -euo pipefail

REPO="savestatedev/savestate"
NAME="savestate"
INSTALL_DIR="${SAVESTATE_INSTALL_DIR:-/usr/local/bin}"

info()  { printf "\033[1;34m→\033[0m %s\n" "$*"; }
ok()    { printf "\033[1;32m✓\033[0m %s\n" "$*"; }
err()   { printf "\033[1;31m✗\033[0m %s\n" "$*" >&2; exit 1; }

detect_platform() {
  local os arch
  os="$(uname -s | tr '[:upper:]' '[:lower:]')"
  arch="$(uname -m)"

  case "$os" in
    linux*)  os="linux" ;;
    darwin*) os="macos" ;;
    *)       err "Unsupported OS: $os" ;;
  esac

  case "$arch" in
    x86_64|amd64)  arch="x64" ;;
    arm64|aarch64) arch="arm64" ;;
    *)             err "Unsupported architecture: $arch" ;;
  esac

  echo "${os}-${arch}"
}

get_latest_version() {
  curl -fsSL "https://api.github.com/repos/${REPO}/releases/latest" \
    | grep '"tag_name"' | head -1 | cut -d'"' -f4
}

main() {
  info "Detecting platform..."
  local platform
  platform="$(detect_platform)"
  ok "Platform: ${platform}"

  info "Finding latest release..."
  local version
  version="$(get_latest_version)"

  if [ -z "$version" ]; then
    info "No binary release found. Falling back to npm..."
    if command -v npx &>/dev/null; then
      info "Installing via npm..."
      npm install -g @savestate/cli
      ok "Installed $(savestate --version)"
      exit 0
    elif command -v brew &>/dev/null; then
      info "Installing via Homebrew..."
      brew tap savestatedev/tap
      brew install savestate
      ok "Installed $(savestate --version)"
      exit 0
    else
      err "No binary release, npm, or Homebrew available. Install Node.js and run: npm install -g @savestate/cli"
    fi
  fi

  ok "Latest: ${version}"

  local url="https://github.com/${REPO}/releases/download/${version}/${NAME}-${platform}"
  info "Downloading ${url}..."

  local tmp
  tmp="$(mktemp)"
  curl -fsSL -o "$tmp" "$url" || err "Download failed. Binary may not exist for ${platform} yet.\nTry: npm install -g @savestate/cli"
  chmod +x "$tmp"

  info "Installing to ${INSTALL_DIR}/${NAME}..."
  if [ -w "$INSTALL_DIR" ]; then
    mv "$tmp" "${INSTALL_DIR}/${NAME}"
  else
    sudo mv "$tmp" "${INSTALL_DIR}/${NAME}"
  fi

  ok "SaveState ${version} installed!"
  echo ""
  echo "  Get started:  savestate init"
  echo "  Take backup:  savestate snapshot"
  echo "  Docs:         https://savestate.dev"
  echo ""
}

main "$@"
