#!/bin/bash
# Run OpenCode inside proot Ubuntu
# Supports 32-bit ARM (armhf) and 64-bit ARM (arm64) devices
# NOTE: OpenCode binary only works on arm64 - on armhf this will fail
UBUNTU_ROOTFS="$1"
PROOT="$2"
WORKDIR="${3:-/root}"

if [ -z "$UBUNTU_ROOTFS" ] || [ -z "$PROOT" ]; then
    echo "Usage: run-opencode.sh <ubuntu_rootfs> <proot_path> [workdir]"
    exit 1
fi

if [ ! -f "$PROOT" ]; then
    echo "ERROR: proot not found at $PROOT"
    exit 1
fi

if [ ! -d "$UBUNTU_ROOTFS/bin" ]; then
    echo "ERROR: Ubuntu rootfs not found at $UBUNTU_ROOTFS"
    exit 1
fi

# Forward API keys and useful env vars
ENV_ARGS=""
for var in OPENAI_API_KEY ANTHROPIC_API_KEY OPENCODE_API_KEY GEMINI_API_KEY; do
    val="${!var}"
    if [ -n "$val" ]; then
        ENV_ARGS="$ENV_ARGS --env $var=$val"
    fi
done

# IMPORTANT: Unset LD_PRELOAD before running proot
# On Android, LD_PRELOAD may be set by the system and will cause
# proot to crash with "loader not found" errors
unset LD_PRELOAD

# For Android 15+ with strict seccomp filters, proot may need
# PROOT_NO_SECCOMP=1 to bypass seccomp restrictions on ptrace.
export PROOT_NO_SECCOMP=1

# Memory optimization for low-RAM devices (4GB or less)
PROOT_OPTS="-0"

# On 32-bit ARM, use a lower LOADER_ADDRESS to avoid memory conflicts
if [ "$(uname -m)" = "armv7l" ] || [ "$(uname -m)" = "armhf" ]; then
    export PROOT_LOADER_ADDRESS=0x20000000
    echo "WARNING: 32-bit ARM detected. OpenCode binary requires arm64."
    echo "This will likely fail. Use API mode instead."
fi

exec "$PROOT" $PROOT_OPTS \
    -r "$UBUNTU_ROOTFS" \
    -b /dev \
    -b /proc \
    -b /sys \
    -b /sdcard /sdcard \
    -b "$UBUNTU_ROOTFS/root/.opencode:/root/.opencode" \
    $ENV_ARGS \
    --env TERM=xterm-256color \
    --env HOME=/root \
    --env PATH=/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin:/root/.opencode/bin \
    --env SSL_CERT_FILE=/etc/ssl/certs/ca-certificates.crt \
    --env PROOT_NO_SECCOMP=1 \
    -w "$WORKDIR" \
    /bin/bash -c '/root/.opencode/bin/opencode "$@"' _ "$@"
