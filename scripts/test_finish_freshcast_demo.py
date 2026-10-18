import contextlib
import importlib.util
import io
import json
import os
from pathlib import Path
import subprocess
import unittest
from unittest.mock import patch

spec = importlib.util.spec_from_file_location('finish_freshcast_demo', Path(__file__).with_name('finish_freshcast_demo.py'))
runner = importlib.util.module_from_spec(spec)
spec.loader.exec_module(runner)


class FinishDemoRunnerTests(unittest.TestCase):
    def setUp(self):
        self.env={'DATABASE_URL':'postgresql://test:fictional-test-password@invalid.example/postgres',
                  'DATABASE_SCHEMA':'django_app'}
        self.preview={'mode':'preview','confirm':'test-signed-preview','proposed_plans':[
            {'order_id':2,'task_count':2,'preparation_start':'2026-10-21 14:00+08:00',
             'preparation_end':'2026-10-21 16:30+08:00','fictional_timing':{'allowances':[
                 {'menu':'Nasi Ayam','maximum_early_finish_minutes':30}]}}],
            'blocked_plans':[],'missing_delivery_dates':[]}

    def result(self,data=None,code=0,error=''):
        return subprocess.CompletedProcess([],code,json.dumps(data) if data is not None else '',error)

    def test_preview_is_read_only_and_does_not_print_database_credentials(self):
        output=io.StringIO()
        with patch.dict(os.environ,self.env,clear=True),patch.object(runner.subprocess,'run',return_value=self.result(self.preview)) as call:
            with contextlib.redirect_stdout(output):self.assertEqual(runner.main([]),0)
        self.assertEqual(call.call_count,1)
        self.assertNotIn('--apply',call.call_args.args[0])
        self.assertIn('PREVIEW ONLY',output.getvalue());self.assertIn('30 minutes',output.getvalue())
        self.assertIn('2026-10-21 14:00',output.getvalue());self.assertIn('Malaysia time',output.getvalue())
        self.assertNotIn('fictional-test-password',output.getvalue())

    def test_apply_uses_fresh_token_same_key_and_exact_eight_order_scope(self):
        saved={'mode':'applied','planned_order_ids':[2],'backup':'private-before.json',
               'blocked_plans':[],'missing_delivery_dates':[]}
        output=io.StringIO()
        with patch.dict(os.environ,self.env,clear=True),patch.object(runner.subprocess,'run',side_effect=[self.result(self.preview),self.result(saved)]) as call:
            with contextlib.redirect_stdout(output):self.assertEqual(runner.main(['--apply']),0)
        first,second=call.call_args_list
        self.assertEqual(first.kwargs['env']['SECRET_KEY'],second.kwargs['env']['SECRET_KEY'])
        arguments=second.args[0]
        ids=[int(arguments[i+1]) for i,value in enumerate(arguments) if value=='--order-id']
        self.assertEqual(tuple(ids),runner.ORDER_IDS)
        self.assertIn('--demo-finish-allowance',arguments)
        self.assertEqual(arguments[arguments.index('--confirm')+1],self.preview['confirm'])
        self.assertIn('--confirm-fictional',arguments)
        self.assertNotIn('--repair-unstarted-requests',arguments)
        self.assertIn('APPLIED',output.getvalue())

    def test_failed_preview_preserves_actual_error_and_does_not_attempt_apply(self):
        error=io.StringIO()
        with patch.dict(os.environ,self.env,clear=True),patch.object(runner.subprocess,'run',return_value=self.result(code=1,error='Specific scheduler failure')) as call:
            with contextlib.redirect_stderr(error):self.assertEqual(runner.main(['--apply']),1)
        self.assertEqual(call.call_count,1);self.assertIn('Specific scheduler failure',error.getvalue())

    def test_missing_database_or_wrong_schema_stops_before_running_django(self):
        for env in [{},{'DATABASE_URL':'sqlite:///:memory:'},dict(self.env,DATABASE_SCHEMA='public')]:
            with patch.dict(os.environ,env,clear=True),patch.object(runner.subprocess,'run') as call:
                with contextlib.redirect_stderr(io.StringIO()):self.assertEqual(runner.main(['--apply']),1)
                call.assert_not_called()

    def test_no_new_plans_is_a_noop_instead_of_an_apply_error(self):
        preview=dict(self.preview,proposed_plans=[])
        with patch.dict(os.environ,self.env,clear=True),patch.object(runner.subprocess,'run',return_value=self.result(preview)) as call:
            with contextlib.redirect_stdout(io.StringIO()):self.assertEqual(runner.main(['--apply']),0)
        self.assertEqual(call.call_count,1)


if __name__=='__main__':
    unittest.main()
