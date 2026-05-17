#!/bin/bash
# Setup Ubuntu inside proot
set -e

UBUNTU_ROOT="$1"
PROOT="$2"

if [ -z "$UBUNTU_ROOT" ] || [ -z "$PROOT" ]; then
    echo "Usage: setup-ubuntu.sh <ubuntu_root> <proot_path>"
    exit 1
fi

if [ -d "$UBUNTU_ROOT/bin" ]; then
    echo "Ubuntu already installed"
    exit 0
fi

echo "Setting up Ubuntu environment..."

# Update and install essential packages
"$PROOT" -0 -r "$UBUNTU_ROOT" -b /dev -b /proc -b /sys /bin/bash -c "
    apt-get update -y
    apt-get upgrade -y
    apt-get install -y curl ca-certificates locales
    locale-gen en_US.UTF-8
    echo 'export LANG=en_US.UTF-8' >> /root/.bashrc
"

echo "Ubuntu setup complete"
