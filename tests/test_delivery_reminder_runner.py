import io
import json
import unittest
from http.client import HTTPException
from contextlib import redirect_stdout
from unittest.mock import patch, MagicMock
from urllib.error import HTTPError, URLError
from deploy.run_delivery_reminders import ENDPOINT, NoRedirect, counts, main


class ReminderRunnerTests(unittest.TestCase):
    secret='fixture-only-reminder-credential-not-for-production'

    def run_main(self, argv, opener):
        with patch.dict('os.environ', {'REMINDER_CRON_SECRET':self.secret}), patch('deploy.run_delivery_reminders.build_opener',return_value=opener), redirect_stdout(io.StringIO()) as output:
            code=main(argv)
        self.assertNotIn(self.secret,output.getvalue())
        return code,output.getvalue()

    def test_default_configuration_check_never_contacts_the_server(self):
        opener=MagicMock();code,text=self.run_main([],opener)
        self.assertEqual(code,0);self.assertIn('No request or email was sent',text);opener.open.assert_not_called()

    def test_actual_run_is_bounded_authenticates_and_logs_only_counts(self):
        opener=MagicMock();response=opener.open.return_value.__enter__.return_value
        response.status=200;response.read.return_value=b'{"sent":2,"failed":0,"private":"not-for-logs"}'
        code,text=self.run_main(['--send'],opener)
        self.assertEqual(code,0);self.assertIn('sent=2',text);self.assertNotIn('not-for-logs',text)
        request=opener.open.call_args.args[0];self.assertEqual(request.full_url,ENDPOINT)
        self.assertEqual(request.get_header('Authorization'),'Bearer '+self.secret)
        self.assertEqual(opener.open.call_args.kwargs['timeout'],55)
        response.read.assert_called_once_with(4097)

    def test_partial_failure_and_invalid_replies_are_not_reported_as_success(self):
        for status,body in [(503,b'{"sent":1,"failed":1}'),(401,b'{"private":"do-not-print"}'),(302,b''),
                            (200,b'<html>private</html>'),(200,b'{"sent":true,"failed":0}'),(200,b'x'*4097)]:
            opener=MagicMock();response=opener.open.return_value.__enter__.return_value
            response.status=status;response.read.return_value=body
            code,text=self.run_main(['--send'],opener)
            self.assertEqual(code,1);self.assertNotIn('do-not-print',text)

    def test_http_and_network_failures_are_sanitized_without_immediate_retry(self):
        for error in [HTTPError(ENDPOINT,503,'private',{},io.BytesIO(b'{"sent":0,"failed":1}')), URLError('private-connection-details'),HTTPException('private-connection-details')]:
            opener=MagicMock();opener.open.side_effect=error
            code,text=self.run_main(['--send'],opener)
            self.assertEqual(code,1);self.assertNotIn('private-connection-details',text);opener.open.assert_called_once()

    def test_invalid_credentials_do_not_reach_the_network(self):
        for secret in ['', 'short', 'x'*32+'\n', 'é'*32]:
            with patch.dict('os.environ',{'REMINDER_CRON_SECRET':secret}),patch('deploy.run_delivery_reminders.build_opener') as opener,redirect_stdout(io.StringIO()):
                self.assertEqual(main(['--send']),1);opener.assert_not_called()

    def test_redirect_is_never_followed_and_count_contract_is_strict(self):
        self.assertIsNone(NoRedirect().redirect_request(None,None,302,'',{},'https://another.example'))
        for bad in [None,[],{}, {'sent':True,'failed':0},{'sent':-1,'failed':0},{'sent':3,'failed':3}]:self.assertIsNone(counts(bad))
