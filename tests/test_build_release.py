import importlib.util
from pathlib import Path
import subprocess
import unittest
from unittest.mock import patch

spec = importlib.util.spec_from_file_location('project_build', Path(__file__).resolve().parents[1] / 'build.py')
build = importlib.util.module_from_spec(spec)
spec.loader.exec_module(build)


class ReleaseGateTests(unittest.TestCase):
    @patch.dict('os.environ', {'VERCEL':'1'})
    @patch.object(build.subprocess, 'run')
    def test_pending_migrations_stop_before_frontend_build(self, run):
        run.return_value = subprocess.CompletedProcess([], 1)
        with self.assertRaisesRegex(RuntimeError, 'Database release check failed'):
            build.main()
        self.assertEqual(run.call_count, 1)
        self.assertEqual(run.call_args.args[0][-2:], ['migrate', '--check'])

    @patch.dict('os.environ', {'VERCEL':'1'})
    @patch.object(build.shutil, 'which', return_value='npm')
    @patch.object(build.subprocess, 'run')
    def test_migrated_database_allows_build(self, run, which):
        run.return_value = subprocess.CompletedProcess([], 0)
        build.main()
        self.assertEqual(run.call_count, 4)
        self.assertTrue(run.call_args_list[1].args[0][-1].endswith('provision_vercel.py'))

    @patch.dict('os.environ', {'VERCEL':'0'})
    @patch.object(build.shutil, 'which', return_value='npm')
    @patch.object(build.subprocess, 'run')
    def test_local_build_does_not_connect_to_database(self, run, which):
        build.main()
        self.assertEqual(run.call_count, 2)
        self.assertTrue(all(call.args[0][0]=='npm' for call in run.call_args_list))
