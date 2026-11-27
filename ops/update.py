#!/usr/bin/env python3
"""Build GitHub main in isolation, atomically activate it, and roll back on failure."""
import argparse
import base64
import fcntl
import hashlib
import json
import os
from pathlib import Path
import shutil
import socket
import sqlite3
import subprocess
import sys
import tarfile
import tempfile
import time
import urllib.request
import uuid

SOURCE = Path('/home/vangaard/bizbuddy')
STATE = Path('/var/lib/bizbuddy')
DATA = SOURCE / 'backend'  # Existing database and encryption key never move.
ENV = {**os.environ, 'GIT_TERMINAL_PROMPT': '0', 'PYTHONDONTWRITEBYTECODE': '1', 'PIP_DISABLE_PIP_VERSION_CHECK': '1'}


def run(*args, cwd=SOURCE, env=None):
    print('+', ' '.join(map(str, args)), flush=True)
    return subprocess.run(list(map(str, args)), cwd=cwd, env=env or ENV, check=True)


def output(*args):
    return subprocess.check_output(args, cwd=SOURCE, env=ENV, text=True).strip()


def digest(file):
    return hashlib.sha256(file.read_bytes()).hexdigest()


def free_space(required):
    free = shutil.disk_usage(STATE).free
    if free < required:
        raise RuntimeError(f'Not enough disk space to prepare dependencies ({free // 1048576} MiB free; {required // 1048576} MiB required). Current site is unchanged.')


def wait_health(url, process=None):
    for _ in range(40):
        if process and process.poll() is not None:
            raise RuntimeError('Staged API exited before becoming healthy.')
        try:
            with urllib.request.urlopen(url, timeout=2) as response:
                if response.status == 200:
                    return
        except OSError:
            pass
        time.sleep(.5)
    raise RuntimeError(f'Health check failed: {url}')


def point_to(release):
    temporary = STATE / f'.current-{uuid.uuid4().hex}'
    temporary.symlink_to(release)
    temporary.replace(STATE / 'current')


def prepare(sha):
    release = STATE / 'releases' / sha
    if (release / '.validated').is_file():
        return release
    if release.exists():
        current = STATE / 'current'
        if current.is_symlink() and current.resolve() == release:
            raise RuntimeError('Active release has no validation marker; refusing to remove it.')
        shutil.rmtree(release)  # Only our incomplete, inactive release directory.
    free_space(20 * 1048576)
    stage = Path(tempfile.mkdtemp(prefix='.build-', dir=STATE))
    try:
        archive = stage / 'source.tar'
        with archive.open('wb') as stream:
            subprocess.run(['git', 'archive', '--format=tar', sha], cwd=SOURCE, stdout=stream, check=True)
        with tarfile.open(archive) as bundle:
            bundle.extractall(stage, filter='data')
        archive.unlink()
        if not (stage / 'ops/gateway.mjs').is_file():
            raise RuntimeError('This commit does not contain the production deployment files.')
        js_hash = digest(stage / 'package-lock.json')
        py_hash = digest(stage / 'backend/requirements.txt')
        js_cache = STATE / 'dependencies' / ('js-' + js_hash)
        py_cache = STATE / 'dependencies' / ('python-' + py_hash)
        if not js_cache.exists():
            free_space(150 * 1048576)
            run('npm', 'ci', '--no-audit', '--no-fund', cwd=stage)
            (stage / 'node_modules').rename(js_cache)
        (stage / 'node_modules').symlink_to(js_cache)
        ready = STATE / 'dependencies' / ('python-' + py_hash + '.ready')
        if not ready.is_file():
            free_space(240 * 1048576)
            if py_cache.exists():
                shutil.rmtree(py_cache)
            try:
                run(sys.executable, '-m', 'venv', py_cache)
                run(py_cache / 'bin/pip', 'install', '--no-cache-dir', '-r', stage / 'backend/requirements.txt')
                ready.touch()
            except BaseException:
                if py_cache.exists():
                    shutil.rmtree(py_cache)
                raise
        (stage / '.venv').symlink_to(py_cache)
        isolated = {**ENV, 'DATABASE_URL': 'sqlite:///' + str(stage / 'validation.db'), 'PUBLIC_API_URL': 'http://testserver', 'OPENAI_API_KEY': '', 'CHATBOT_ENCRYPTION_KEY': base64.urlsafe_b64encode(os.urandom(32)).decode()}
        run('npm', 'run', 'lint', cwd=stage)
        run('npm', 'run', 'build', cwd=stage)
        run('node', '--check', stage / 'ops/gateway.mjs')
        run(sys.executable, stage / 'ops/test_gateway.py', cwd=stage)
        run(sys.executable, stage / 'ops/test_update.py', cwd=stage)
        run(py_cache / 'bin/python', '-W', 'ignore', '-m', 'unittest', 'discover', '-s', 'backend', '-p', 'test_*.py', cwd=stage, env=isolated)
        with socket.socket() as listener:
            listener.bind(('127.0.0.1', 0))
            port = listener.getsockname()[1]
        log_path = STATE / 'logs' / ('validation-' + sha + '.log')
        with log_path.open('w') as log:
            process = subprocess.Popen([str(py_cache / 'bin/python'), '-m', 'uvicorn', 'main:app', '--host', '127.0.0.1', '--port', str(port)], cwd=stage / 'backend', env=isolated, stdout=log, stderr=log)
            try:
                wait_health(f'http://127.0.0.1:{port}/api/health', process)
            finally:
                process.terminate()
                try:
                    process.wait(timeout=8)
                except subprocess.TimeoutExpired:
                    process.kill()
                    process.wait()
        for name in ('validation.db', 'validation.db-shm', 'validation.db-wal'):
            (stage / name).unlink(missing_ok=True)
        (stage / 'node_modules').unlink()
        if (DATA / '.env').exists():
            (stage / 'backend/.env').symlink_to(DATA / '.env')
        (stage / '.validated').write_text(json.dumps({'commit': sha, 'js': js_hash, 'python': py_hash, 'validated_at': time.time()}))
        stage.rename(release)
        return release
    except BaseException:
        shutil.rmtree(stage, ignore_errors=True)
        raise


def activate(release):
    current = STATE / 'current'
    previous = current.resolve() if current.is_symlink() else None
    if previous == release:
        print('Already deployed:', release.name)
        return
    database = DATA / 'bizbuddy.db'
    if database.exists():
        backup = STATE / 'backups' / f'{int(time.time())}-{release.name[:12]}.db'
        with sqlite3.connect(database) as source, sqlite3.connect(backup) as target:
            source.backup(target)
        backup.chmod(0o600)
    point_to(release)
    try:
        run('sudo', '-n', '/usr/bin/systemctl', 'restart', 'bizbuddy-api.service')
        wait_health('http://127.0.0.1:8000/api/health')
        if previous and digest(previous / 'ops/gateway.mjs') != digest(release / 'ops/gateway.mjs'):
            run('sudo', '-n', '/usr/bin/systemctl', 'restart', 'bizbuddy-web.service')
            wait_health('http://172.18.0.1:5173/__deployment')
        (STATE / 'last-success.json').write_text(json.dumps({'commit': release.name, 'previous': previous.name if previous else None, 'deployed_at': time.time()}, indent=2) + '\n')
    except BaseException:
        if previous:
            print('Activation failed; restoring previous code release.', flush=True)
            point_to(previous)
            run('sudo', '-n', '/usr/bin/systemctl', 'restart', 'bizbuddy-api.service')
            if digest(previous / 'ops/gateway.mjs') != digest(release / 'ops/gateway.mjs'):
                run('sudo', '-n', '/usr/bin/systemctl', 'restart', 'bizbuddy-web.service')
            wait_health('http://127.0.0.1:8000/api/health')
        raise
    # Keep the active version and two previous versions (including their assets).
    versions = sorted((p for p in (STATE / 'releases').iterdir() if p.is_dir() and len(p.name) == 40), key=lambda p: p.stat().st_mtime, reverse=True)
    keep = {release, previous, *versions[:3]}
    for old in versions:
        if old not in keep:
            shutil.rmtree(old)
    for backup in sorted((STATE / 'backups').glob('*.db'), key=lambda p: p.stat().st_mtime, reverse=True)[7:]:
        backup.unlink()
    print('Deployed:', release.name, flush=True)


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--prepare-only', action='store_true')
    parser.add_argument('--ref', default='refs/remotes/origin/main')
    parser.add_argument('--no-fetch', action='store_true')
    args = parser.parse_args()
    for directory in ('releases', 'dependencies', 'logs', 'backups'):
        (STATE / directory).mkdir(parents=True, exist_ok=True)
    with (STATE / 'update.lock').open('w') as lock:
        try:
            fcntl.flock(lock, fcntl.LOCK_EX | fcntl.LOCK_NB)
        except BlockingIOError:
            print('Another BizBuddy update is running; skipping.')
            return
        if not args.no_fetch:
            run('git', 'fetch', 'origin', '+refs/heads/main:refs/remotes/origin/main')
        sha = output('git', 'rev-parse', '--verify', args.ref + '^{commit}')
        current = STATE / 'current'
        if current.is_symlink() and current.resolve().name == sha and not args.prepare_only:
            print('Already deployed:', sha)
            return
        release = prepare(sha)
        if args.prepare_only:
            print('Validated release:', release)
        else:
            activate(release)


if __name__ == '__main__':
    try:
        main()
    except Exception as error:
        print('BizBuddy update failed:', error, file=sys.stderr, flush=True)
        sys.exit(1)
