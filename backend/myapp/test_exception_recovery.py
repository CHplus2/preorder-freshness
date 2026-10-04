from unittest.mock import patch
from django.test import SimpleTestCase
from django.db import OperationalError, IntegrityError
from rest_framework.exceptions import ValidationError
from .exceptions import api_exception_handler

class ExceptionRecoveryTests(SimpleTestCase):
    def test_validation_remains_actionable(self):
        response=api_exception_handler(ValidationError({'quantity':['Must be positive.']}),{})
        self.assertEqual(response.status_code,400)
        self.assertIn('quantity',response.data)

    def test_conflict_does_not_expose_database_details(self):
        response=api_exception_handler(IntegrityError('private database constraint'),{})
        self.assertEqual(response.status_code,409)
        self.assertNotIn('private',str(response.data))

    @patch('myapp.exceptions.logger.error')
    def test_database_outage_is_correlated_and_sanitised(self,log):
        response=api_exception_handler(OperationalError('private connection credentials'),{})
        self.assertEqual(response.status_code,503)
        self.assertEqual(len(response.data['reference']),12)
        self.assertNotIn('private',str(response.data))
        log.assert_called_once()

    @patch('myapp.exceptions.logger.error')
    def test_unexpected_failure_is_not_reported_as_success(self,log):
        response=api_exception_handler(RuntimeError('private traceback'),{})
        self.assertEqual(response.status_code,500)
        self.assertIn('reference',response.data)
        self.assertNotIn('private',str(response.data))
