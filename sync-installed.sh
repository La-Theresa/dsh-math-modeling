#!/usr/bin/env bash
# Sync the math-modeling preset from this source directory into the DSH agent
# preset directory.
#
# Target:
#   ${DSH_HOME:-$HOME/.dsh}/.agent-presets/math-modeling
#
# Usage:
#   bash math-modeling/sync-installed.sh
#
# Note: if DSH is already running, restart it after syncing so the new
# preset.yml description and files are loaded.
set -euo pipefail

cd "$(dirname "$0")"

TARGET="${DSH_HOME:-$HOME/.dsh}/.agent-presets/math-modeling"
mkdir -p "$(dirname "$TARGET")"
rm -rf "$TARGET"
cp -a . "$TARGET"
rm -f "$TARGET/.venv"

echo "Math Modeling preset synced to: $TARGET"
echo "Restart DeepSeek Harness to load the updated description."
