import subprocess
import unittest
from unittest.mock import patch
from deploy.apply_dapur_kita_demo import main


class DemoReleaseTests(unittest.TestCase):
    def test_missing_confirmation_refuses_build_and_data_changes(self):
        with patch.dict('os.environ', {}, clear=True), patch('deploy.apply_dapur_kita_demo.subprocess.run') as run:
            with self.assertRaises(RuntimeError):
                main()
            run.assert_not_called()

    def test_failed_normal_build_never_runs_the_rewrite(self):
        with patch.dict('os.environ', {'DAPUR_KITA_CONFIRMED_FICTIONAL': '1', 'DAPUR_KITA_DEMO_FINGERPRINT': 'a'*64}), patch('deploy.apply_dapur_kita_demo.subprocess.run', side_effect=subprocess.CalledProcessError(1, 'build')) as run:
            with self.assertRaises(subprocess.CalledProcessError):
                main()
            self.assertEqual(run.call_count, 1)
            self.assertTrue(run.call_args.args[0][-1].endswith('build.py'))

    def test_successful_build_then_explicit_rewrite(self):
        with patch.dict('os.environ', {'DAPUR_KITA_CONFIRMED_FICTIONAL': '1', 'DAPUR_KITA_DEMO_FINGERPRINT': 'b'*64}), patch('deploy.apply_dapur_kita_demo.subprocess.run') as run:
            main()
            self.assertEqual(run.call_count, 2)
            command = run.call_args_list[1].args[0]
            self.assertIn('--confirm-fictional', command)
            self.assertIn('b'*64, command)
