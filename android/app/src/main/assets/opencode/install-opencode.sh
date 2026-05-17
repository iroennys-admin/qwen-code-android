#!/bin/bash
# Install OpenCode inside proot Ubuntu
# OpenCode binary is only available for arm64 - this script will fail on 32-bit
set -e

UBUNTU_ROOT="$1"
PROOT="$2"

if [ -z "$UBUNTU_ROOT" ] || [ -z "$PROOT" ]; then
    echo "Usage: install-opencode.sh <ubuntu_root> <proot_path>"
    exit 1
fi

OPENCODE_BIN="$UBUNTU_ROOT/root/.opencode/bin/opencode"

if [ -f "$OPENCODE_BIN" ]; then
    echo "OpenCode already installed"
    exit 0
fi

echo "Installing OpenCode..."

"$PROOT" -0 -r "$UBUNTU_ROOT" -b /dev -b /proc -b /sys /bin/bash -c '
    export SHELL=/bin/bash
    export TMPDIR=/tmp
    export HOME=/root
    export PATH=/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin
    curl -fsSL https://opencode.ai/install | bash -s -- --no-modify-path
'

if [ ! -f "$OPENCODE_BIN" ]; then
    echo "ERROR: OpenCode binary not found after install"
    exit 1
fi

# Add opencode to PATH in bashrc
if ! grep -q '.opencode/bin' "$UBUNTU_ROOT/root/.bashrc" 2>/dev/null; then
    printf '\n# opencode\nexport PATH=/root/.opencode/bin:$PATH\n' >> "$UBUNTU_ROOT/root/.bashrc"
fi

echo "OpenCode installed successfully"
