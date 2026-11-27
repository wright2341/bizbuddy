#!/usr/bin/env bash
# Optional, server-only embedded SDK dependencies. No desktop/CLI is installed.
set -euo pipefail
cd /home/vangaard/bizbuddy
runtime=/var/lib/bizbuddy/opencode-2.4.2
if [[ -e "$runtime/node_modules/@opencode/sdk/dist/index.js" ]]; then
  echo 'The pinned OpenCode SDK runtime is already installed.'
  exit 0
fi
python3 - <<'CHECK'
import shutil
if shutil.disk_usage('/var/lib/bizbuddy').free < 700 * 1024 * 1024:
    raise SystemExit('Allow 700 MiB free disk space before installing the SDK. The current website remains running.')
CHECK
stage=$(mktemp -d /var/lib/bizbuddy/.opencode-install-XXXXXX)
cp ai/opencode/package.json ai/opencode/package-lock.json "$stage/"
npm ci --prefix "$stage" --ignore-scripts --no-audit --no-fund
mv "$stage" "$runtime"
echo "Installed embedded SDK at $runtime. See README for server-only configuration."
