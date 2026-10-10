"""Apply the reviewed photo URLs only, through the existing staff/CSRF API.

Read-only by default. Deploy the checked-in public assets before using --apply.
Never imports recipes, reprices orders, creates stock, or trains a model.
"""
import argparse
from datetime import datetime, timezone
import hashlib
import json
import os
from pathlib import Path
import tempfile
import urllib.error
import urllib.parse
import urllib.request

from import_dapur_kita import StaffAPI, ImportErrorDetail, index_names, require, rows

ROOT = Path(__file__).resolve().parents[1]
SOURCE = ROOT / 'docs/DAPUR-KITA-STARTER-DATA.json'
ASSETS = ROOT / 'frontend/public/menu-images'


def photo_plan(api, source, base_url):
    products = rows(api, 'products/')
    current = index_names(products, 'existing menu')
    menus = source['menus']
    require(len(menus) == 24, 'Expected the complete 24-menu catalogue.')
    index_names(menus, 'source menu')
    plan = []
    for menu in menus:
        target = current.get(menu['name'].strip().casefold())
        require(target is not None, f'{menu["name"]}: missing live menu; no changes applied.')
        url = urllib.parse.urlsplit(menu['image_url'])
        origin = urllib.parse.urlsplit(base_url)
        require(url.scheme == 'https' and url.netloc == origin.netloc and
                url.path.startswith('/static/menu-images/') and not url.query and not url.fragment,
                f'{menu["name"]}: expected a photo on the selected HTTPS origin.')
        filename = url.path.removeprefix('/static/menu-images/')
        require('/' not in filename and filename.endswith('.jpg'), 'Unexpected image path.')
        local = ASSETS / filename
        require(local.is_file() and local.stat().st_size > 0, f'{menu["name"]}: local photo missing.')
        plan.append({'id': target['id'], 'name': target['name'],
                     'before_image_url': target['image_url'], 'image_url': menu['image_url'],
                     'sha256': hashlib.sha256(local.read_bytes()).hexdigest()})
    return products, plan


def verify_public_photos(plan):
    # No staff cookie or credential is sent when checking public files.
    for url, expected in {(row['image_url'], row['sha256']) for row in plan}:
        try:
            with urllib.request.urlopen(url, timeout=45) as response:
                require(response.headers.get('Content-Type', '').split(';')[0] == 'image/jpeg',
                        'A deployed image has an unexpected content type.')
                image = response.read(8 * 1024 * 1024 + 1)
            require(len(image) <= 8 * 1024 * 1024 and hashlib.sha256(image).hexdigest() == expected,
                    'A deployed photo differs from the reviewed local asset.')
        except (urllib.error.URLError, TimeoutError):
            raise ImportErrorDetail('A photo is not available on the selected host. Deploy assets before applying URLs.') from None


def unchanged_fields(before, after):
    return all(value == after.get(key) for key, value in before.items()
               if key not in {'image_url', 'updated_at'})


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--url', default='https://preorder-freshness.vercel.app')
    parser.add_argument('--apply', action='store_true')
    parser.add_argument('--report-dir', type=Path)
    args = parser.parse_args()
    require(os.environ.get('DJANGO_STAFF_USERNAME') and os.environ.get('DJANGO_STAFF_PASSWORD'),
            'Supply existing Django staff credentials through secure environment settings.')
    api = StaffAPI(args.url, os.environ['DJANGO_STAFF_USERNAME'], os.environ['DJANGO_STAFF_PASSWORD'])
    before, plan = photo_plan(api, json.loads(SOURCE.read_text()), args.url)
    verify_public_photos(plan)
    changes = [r for r in plan if r['before_image_url'] != r['image_url']]
    print(json.dumps({'menus': len(plan), 'distinct_photos': len({r['image_url'] for r in plan}),
                      'changes': len(changes), 'mode': 'apply' if args.apply else 'read-only'}))
    if not args.apply:
        return
    report = args.report_dir or Path(tempfile.gettempdir()) / 'dapur-kita-photos' / datetime.now(timezone.utc).strftime('%Y%m%dT%H%M%SZ')
    report.mkdir(parents=True, exist_ok=True)
    snapshot = report / 'products-before.json'
    snapshot.write_text(json.dumps(before, indent=2)); snapshot.chmod(0o600)
    receipt = report / 'receipt.json'
    saved = []
    by_id = {p['id']: p for p in before}
    for row in changes:
        latest = api.request('GET', f'products/{row["id"]}/')
        require(latest == by_id[row['id']], f'{row["name"]}: concurrently edited; stopped before this update.')
        result = api.request('PATCH', f'products/{row["id"]}/', {'image_url': row['image_url']})
        require(result['image_url'] == row['image_url'] and unchanged_fields(latest, result),
                f'{row["name"]}: saved fields differ unexpectedly; inspect the receipt.')
        saved.append(row); receipt.write_text(json.dumps(saved, indent=2)); receipt.chmod(0o600)
    after = rows(api, 'products/')
    require(len(after) == len(before), 'Catalogue size changed during the update.')
    after_by_id = {p['id']: p for p in after}
    expected = {p['id']: p['image_url'] for p in plan}
    for product in before:
        result = after_by_id[product['id']]
        require(unchanged_fields(product, result), 'Non-photo catalogue fields changed during the update.')
        require(result['image_url'] == expected.get(product['id'], product['image_url']), 'Photo verification failed.')
    print(json.dumps({'updated': len(saved), 'verified': len(plan), 'other_catalogue_fields_preserved': True,
                      'receipt_directory': str(report)}))


if __name__ == '__main__':
    try:
        main()
    except (ImportErrorDetail, KeyError) as exc:
        raise SystemExit(str(exc)) from None
