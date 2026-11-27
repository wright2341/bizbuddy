"""Verify update failures cannot replace or delete the active release."""
import importlib.util
from pathlib import Path
import subprocess
import tempfile
import unittest
from unittest.mock import patch

spec = importlib.util.spec_from_file_location('bizbuddy_update', Path(__file__).with_name('update.py'))
update = importlib.util.module_from_spec(spec)
spec.loader.exec_module(update)


class UpdateSafetyTests(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.state = Path(self.temp.name)
        for name in ('releases', 'backups', 'logs', 'dependencies', 'data'):
            (self.state / name).mkdir()
        self.previous = self.release('a' * 40)
        self.next = self.release('b' * 40)
        (self.state / 'current').symlink_to(self.previous)
        self.state_patch = patch.object(update, 'STATE', self.state)
        self.data_patch = patch.object(update, 'DATA', self.state / 'data')
        self.state_patch.start()
        self.data_patch.start()

    def tearDown(self):
        self.data_patch.stop()
        self.state_patch.stop()
        self.temp.cleanup()

    def release(self, sha):
        release = self.state / 'releases' / sha
        (release / 'ops').mkdir(parents=True)
        (release / 'ops/gateway.mjs').write_text('// unchanged stable gateway')
        (release / '.validated').write_text('{}')
        return release

    def test_failed_activation_restores_previous_code(self):
        failure = subprocess.CalledProcessError(1, ['systemctl', 'restart'])
        with patch.object(update, 'run', side_effect=[failure, None]) as restart, patch.object(update, 'wait_health') as health:
            with self.assertRaises(subprocess.CalledProcessError):
                update.activate(self.next)
            self.assertEqual((self.state / 'current').resolve(), self.previous)
            self.assertEqual(restart.call_count, 2)
            health.assert_called_once_with('http://127.0.0.1:8000/api/health')
            self.assertFalse((self.state / 'last-success.json').exists())

    def test_missing_marker_cannot_delete_active_release(self):
        (self.previous / '.validated').unlink()
        with self.assertRaisesRegex(RuntimeError, 'Active release'):
            update.prepare(self.previous.name)
        self.assertTrue(self.previous.is_dir())
        self.assertEqual((self.state / 'current').resolve(), self.previous)

    def test_archive_failure_cleans_only_staging_directory(self):
        with patch.object(update.subprocess, 'run', side_effect=subprocess.CalledProcessError(1, ['git', 'archive'])):
            with self.assertRaises(subprocess.CalledProcessError):
                update.prepare('c' * 40)
        self.assertFalse(list(self.state.glob('.build-*')))
        self.assertEqual((self.state / 'current').resolve(), self.previous)

    def test_validated_release_is_reused_without_installing(self):
        with patch.object(update, 'run') as run:
            self.assertEqual(update.prepare(self.next.name), self.next)
            run.assert_not_called()

    def test_insufficient_disk_space_aborts_preparation(self):
        with patch.object(update.shutil, 'disk_usage', return_value=type('Space', (), {'free': 0})()):
            with self.assertRaisesRegex(RuntimeError, 'Not enough disk space'):
                update.prepare('c' * 40)
        self.assertEqual((self.state / 'current').resolve(), self.previous)
        self.assertFalse(list(self.state.glob('.build-*')))


if __name__ == '__main__':
    unittest.main()
