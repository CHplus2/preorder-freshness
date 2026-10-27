"""Call this site's bounded reminder worker without exposing its bearer secret."""
import argparse
import json
import os
from http.client import HTTPException
from urllib.error import HTTPError, URLError
from urllib.request import HTTPRedirectHandler, Request, build_opener

ENDPOINT = 'https://preorder-freshness.vercel.app/api/reminders/run/'


def report(title, message):
    """Publish fixed, non-secret evidence on the Actions run's summary page."""
    print(message)
    destination = os.getenv('GITHUB_STEP_SUMMARY')
    if destination:
        event = 'Scheduled' if os.getenv('GITHUB_EVENT_NAME') == 'schedule' else 'Manual'
        try:
            with open(destination, 'a', encoding='utf-8') as summary:
                summary.write(f'## {title}\n\n{event} execution. {message}\n\n')
        except OSError:
            print('The run summary could not be saved. Refer to this step’s output.')


class NoRedirect(HTTPRedirectHandler):
    def redirect_request(self, req, fp, code, msg, headers, newurl):
        return None  # Never forward the bearer credential to a redirect target.


def counts(payload):
    if not isinstance(payload, dict):
        return None
    values = {key: payload.get(key) for key in ('sent', 'failed')}
    if any(type(value) is not int or not 0 <= value <= 3 for value in values.values()):
        return None
    return values if sum(values.values()) <= 3 else None


def main(argv=None):
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--send', action='store_true', help='Execute the worker; may send real opted-in/owner emails.')
    options = parser.parse_args(argv)
    secret = os.getenv('REMINDER_CRON_SECRET', '')
    if len(secret) < 32 or any(ord(char) < 33 or ord(char) > 126 for char in secret):
        report('Reminder configuration needs attention', 'Configure the private REMINDER_CRON_SECRET repository secret to match the server CRON_SECRET (at least 32 printable characters).')
        return 1
    if not options.send:
        report('Configuration check only — no email sent', 'Local scheduler configuration is present. No request or email was sent; server credentials and delivery are not verified. To execute the worker, start a new Run workflow with Execute the worker selected. Re-running this check keeps its original inputs.')
        return 0
    request = Request(ENDPOINT, headers={'Authorization': 'Bearer '+secret, 'Accept': 'application/json'})
    try:
        with build_opener(NoRedirect()).open(request, timeout=55) as response:
            status = response.status
            data = response.read(4097)
    except HTTPError as error:
        status = error.code
        try:
            data = error.read(4097)
        except (OSError, HTTPException):
            report('Worker result could not be confirmed', 'The reminder response could not be read. Check the next scheduled run.')
            return 1
        finally:
            error.close()
    except (URLError, TimeoutError, OSError, HTTPException):
        report('Worker result could not be confirmed', 'The reminder worker could not be reached. No immediate retry was made; check the next scheduled run.')
        return 1
    if len(data) > 4096:
        report('Worker result could not be confirmed', 'The reminder worker returned an unexpected response. Check its deployment and scheduler configuration.')
        return 1
    try:
        result = counts(json.loads(data))
    except (ValueError, UnicodeError):
        result = None
    if status not in (200, 503) or result is None:
        report('Reminder worker needs attention', f'The reminder worker returned HTTP {status}; check authorization, email configuration and deployment. Response content is not logged.')
        return 1
    title = 'Reminder worker completed' if status == 200 and result['failed'] == 0 else 'Reminder worker reported a failure'
    message = f"Reminder worker HTTP {status}: sent={result['sent']}, failed={result['failed']}. Provider acceptance does not prove inbox receipt."
    if sum(result.values()) == 0:
        message += ' No emails were attempted. There may be no eligible unsent reminders, or another worker may be handling them. Review Settings → Order email reminders.'
    report(title, message)
    return 0 if status == 200 and result['failed'] == 0 else 1


if __name__ == '__main__':
    raise SystemExit(main())
