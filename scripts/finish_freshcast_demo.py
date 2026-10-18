"""Review or finish the owner's eight fictional demo preparation requests.

Uses the current Python virtual environment and already-configured database.
Default: preview only. --apply signs a fresh preview and saves feasible plans
with a private backup. No catalogue, order dates, payments or stock are changed.
"""
import argparse
from datetime import datetime, timedelta, timezone
import json
import os
from pathlib import Path
import secrets
import subprocess
import sys
from uuid import uuid4

ROOT = Path(__file__).resolve().parents[1]
ORDER_IDS = (2, 4, 7, 9, 10, 13, 14, 16)


def local_time(value):
    return datetime.fromisoformat(value).astimezone(timezone(timedelta(hours=8))).strftime('%Y-%m-%d %H:%M')


def main(argv=None):
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--apply', action='store_true', help='Save feasible fictional plans after a fresh preview, with backup.')
    parser.add_argument('--actor-id', type=int, default=2)
    options = parser.parse_args(argv)
    if not os.environ.get('DATABASE_URL', '').startswith(('postgresql://', 'postgres://')):
        print('Use the same PowerShell session with your working Supabase DATABASE_URL. It was not printed or changed.', file=sys.stderr)
        return 1
    if os.environ.get('DATABASE_SCHEMA') != 'django_app':
        print('Set DATABASE_SCHEMA to django_app in your connected PowerShell session before continuing.', file=sys.stderr)
        return 1
    env = dict(os.environ, PYTHON_DOTENV_DISABLED='1')
    if not env.get('SECRET_KEY'):
        env['SECRET_KEY'] = secrets.token_urlsafe(48)
    command = [sys.executable, str(ROOT/'backend/manage.py'), 'plan_freshcast_demo_orders',
               '--actor-id', str(options.actor_id), '--use-current-preparation', '--demo-finish-allowance']
    for pk in ORDER_IDS:
        command += ['--order-id', str(pk)]

    def run(extra=()):
        result = subprocess.run(command+list(extra), cwd=ROOT, env=env, capture_output=True,
                                text=True, encoding='utf-8', errors='replace')
        if result.returncode:
            print(result.stderr or 'The maintenance command failed without an error message.', file=sys.stderr)
            return None
        try:
            return json.loads(result.stdout)
        except ValueError:
            print('The maintenance command returned an unreadable response. No further action was attempted.', file=sys.stderr)
            return None

    preview = run()
    if not preview or preview.get('mode') != 'preview' or not preview.get('confirm'):
        return 1
    print('FICTIONAL DEMO TIMINGS: early finish is a scenario assumption, not a verified food holding limit.')
    print('Only orders '+', '.join('#'+str(pk) for pk in ORDER_IDS)+' are in scope.')
    plans = preview['proposed_plans']
    for row in plans:
        print(f"Order #{row['order_id']}: {row['task_count']} tasks; {local_time(row['preparation_start'])} to {local_time(row['preparation_end'])} (Malaysia time)")
        for allowance in row.get('fictional_timing', {}).get('allowances', []):
            print(f"  {allowance['menu']}: allow up to {allowance['maximum_early_finish_minutes']} minutes before dispatch (demo assumption).")
    for row in preview['blocked_plans']:
        print(f"Still needs review: order #{row['order_id']}: {row.get('reason')}")
    for row in preview['missing_delivery_dates']:
        print(f"Delivery date needs review: order #{row['order_id']}.")
    if not options.apply:
        print(f'PREVIEW ONLY: {len(plans)} plans proposed; no changes saved. Review the timings before running with --apply.')
        return 0
    if not plans:
        print('No new feasible plans to save. Existing accepted plans were preserved; review any blockers above.')
        return 0
    backup = Path.home()/'FreshCast-backups'/f"before-demo-timing-{datetime.now():%Y%m%d-%H%M%S}-{uuid4().hex[:8]}.json"
    saved = run(['--apply', '--confirm-fictional', '--confirm', preview['confirm'], '--backup', str(backup)])
    if not saved or saved.get('mode') != 'applied':
        return 1
    print('APPLIED: task plans saved for orders '+', '.join('#'+str(pk) for pk in saved['planned_order_ids']))
    print('Private before-backup: '+saved['backup'])
    print(f"Still blocked: {len(saved['blocked_plans'])}; missing delivery dates: {len(saved['missing_delivery_dates'])}. Refresh Planner.")
    return 0


if __name__ == '__main__':
    raise SystemExit(main())
