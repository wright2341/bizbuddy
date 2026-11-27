#!/usr/bin/env bash
# Run as the VPS account vangaard after committing these files.
set -euo pipefail
cd /home/vangaard/bizbuddy
state=/var/lib/bizbuddy
first_install=0
vite_stopped=0
installed=0
if [[ ! -L "$state/current" ]]; then first_install=1; fi
sudo install -d -o vangaard -g vangaard -m 0750 "$state" "$state/releases" "$state/dependencies" "$state/logs" "$state/backups"

# Reuse the already-tested dependency installations for the initial release.
# Future changes to either lockfile get their own isolated dependency cache.
backend/.venv/bin/pip check
npm ls --depth=0
python3 - <<'PY'
import hashlib
from pathlib import Path
source=Path('/home/vangaard/bizbuddy')
cache=Path('/var/lib/bizbuddy/dependencies')
for manifest, prefix, target in [('package-lock.json','js-',source/'node_modules'),('backend/requirements.txt','python-',source/'backend/.venv')]:
    fingerprint=hashlib.sha256((source/manifest).read_bytes()).hexdigest()
    destination=cache/(prefix+fingerprint)
    if not destination.exists():
        destination.symlink_to(target)
    if prefix=='python-':
        (cache/(prefix+fingerprint+'.ready')).touch()
PY
python3 ops/update.py --prepare-only --no-fetch --ref HEAD
sudo cp /etc/systemd/system/bizbuddy-api.service "$state/api-before-install.service"
restore_initial() {
  if [[ "$installed" == 0 && "$first_install" == 1 ]]; then
    sudo systemctl stop bizbuddy-web.service || true
    sudo install -m 0644 "$state/api-before-install.service" /etc/systemd/system/bizbuddy-api.service
    sudo systemctl daemon-reload
    sudo systemctl restart bizbuddy-api.service
    if [[ "$vite_stopped" == 1 ]]; then
      python3 - <<'PY'
import subprocess
with open('/var/lib/bizbuddy/logs/vite-recovery.log','ab') as log:
    subprocess.Popen(['npm','run','dev','--','--host','172.18.0.1','--port','5173','--strictPort'],cwd='/home/vangaard/bizbuddy',stdout=log,stderr=log,start_new_session=True)
PY
    fi
  fi
}
trap restore_initial EXIT
sudo visudo -cf ops/bizbuddy-update.sudoers
sudo install -m 0440 ops/bizbuddy-update.sudoers /etc/sudoers.d/bizbuddy-update
sudo install -m 0644 ops/bizbuddy-api.service ops/bizbuddy-web.service ops/bizbuddy-update.service ops/bizbuddy-update.timer /etc/systemd/system/
sudo systemctl daemon-reload
python3 ops/update.py --no-fetch --ref HEAD
sudo systemctl enable --now bizbuddy-api.service bizbuddy-web.service

# Stop only the original BizBuddy Vite process after the new gateway is waiting.
# Caddy and the NaijaTown containers are never restarted or reconfigured.
if [[ "$first_install" == 1 ]]; then
  python3 - <<'PY'
import os
from pathlib import Path
import signal
for proc in Path('/proc').iterdir():
    if not proc.name.isdigit():
        continue
    try:
        args=(proc/'cmdline').read_bytes().split(b'\0')
        if b'/home/vangaard/bizbuddy/node_modules/.bin/vite' in args and (proc/'cwd').resolve()==Path('/home/vangaard/bizbuddy') and proc.stat().st_uid==os.getuid():
            os.kill(int(proc.name),signal.SIGTERM)
    except (OSError, ProcessLookupError):
        pass
PY
  vite_stopped=1
fi
python3 - <<'PY'
import json
import subprocess
import time
import urllib.request
sha=subprocess.check_output(['git','rev-parse','HEAD'],text=True).strip()
for attempt in range(40):
    try:
        with urllib.request.urlopen('http://172.18.0.1:5173/__deployment',timeout=2) as response:
            if json.load(response)['commit']==sha:
                print('Production gateway is serving commit',sha)
                break
    except (OSError,ValueError,KeyError):
        time.sleep(.25)
else:
    raise SystemExit('Production gateway did not become ready.')
PY
sudo systemctl enable --now bizbuddy-update.timer
installed=1
trap - EXIT
printf 'BizBuddy automatic updates are enabled for GitHub main.\n'
