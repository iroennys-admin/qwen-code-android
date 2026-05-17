#!/bin/bash
# Run OpenCode inside proot Ubuntu
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

unset LD_PRELOAD

exec "$PROOT" -0 \
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
    -w "$WORKDIR" \
    /bin/bash -c '/root/.opencode/bin/opencode "$@"' _ "$@"
