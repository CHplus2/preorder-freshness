"""Import the reviewed starter catalogue through existing staff APIs, never stock.

No new API, authentication bypass, database connection or deployment is needed.
Default: read-only plan. --apply performs the plan; API writes are not one
database transaction. Rerunning reconciles names without creating duplicates.
"""
import argparse
from copy import deepcopy
from datetime import datetime, timezone
from decimal import Decimal, InvalidOperation
import http.cookiejar
import json
import os
from pathlib import Path
import tempfile
import urllib.error
import urllib.parse
import urllib.request

SOURCE = Path(__file__).resolve().parents[1] / 'docs/DAPUR-KITA-STARTER-DATA.json'
MENU_FIELDS = {
    'name', 'price', 'description', 'category', 'image_url', 'social_url',
    'packaging_cost', 'lead_hours', 'batch_size', 'daily_capacity',
    'max_preparation_days', 'max_early_minutes', 'preparation_minutes',
    'additional_batch_minutes', 'packing_minutes_per_portion',
    'ingredients', 'preparation_tasks', 'allergen_review',
}
LIMITS = {
    'lead_hours': (1, 2160), 'batch_size': (1, 5000),
    'daily_capacity': (1, 10000), 'max_preparation_days': (1, 30),
    'max_early_minutes': (0, 720), 'preparation_minutes': (1, 1440),
    'additional_batch_minutes': (1, 1440), 'packing_minutes_per_portion': (0, 60),
}
RESOURCES = {'prep_table', 'stove', 'oven', 'rice_cooker', 'fridge', 'packing_area', 'none'}


class ImportErrorDetail(Exception):
    pass


def require(condition, message):
    if not condition:
        raise ImportErrorDetail(message)


def index_names(rows, label):
    index = {}
    for row in rows:
        key = row['name'].strip().casefold()
        require(key and key not in index, f'Duplicate or blank {label}: {row["name"]!r}. Resolve before importing.')
        index[key] = row
    return index


def decimal_value(value, low, digits, places):
    try:
        number = Decimal(str(value))
        return (number.is_finite() and number >= Decimal(low)
                and number < Decimal(10) ** (digits - places)
                and number == number.quantize(Decimal(10) ** -places))
    except (InvalidOperation, ValueError):
        return False


def validate_source(source):
    """Validate every menu before any network writes, including the last recipe."""
    materials = index_names(source['raw_materials'], 'source material')
    index_names(source['menus'], 'source menu')
    for material in materials.values():
        require(set(material) == {'name', 'unit', 'estimated_unit_cost'}, 'Unsupported material fields.')
        require(len(material['name']) <= 100 and material['unit'] in {'g', 'kg', 'ml', 'l', 'unit'}, 'Invalid material name or unit.')
        require(decimal_value(material['estimated_unit_cost'], '0', 14, 6), 'Invalid estimated unit cost.')
    for menu in source['menus']:
        name = menu['name']
        require(set(menu) == MENU_FIELDS, f'{name}: missing or unsupported menu fields.')
        require(len(name) <= 200 and 0 < len(menu['category']) <= 100, f'{name}: invalid name/category.')
        for field, (low, high) in LIMITS.items():
            require(type(menu[field]) is int and low <= menu[field] <= high, f'{name}: invalid {field}.')
        require(decimal_value(menu['price'], '0.01', 10, 2), f'{name}: invalid price.')
        require(decimal_value(menu['packaging_cost'], '0', 10, 2), f'{name}: invalid packaging cost.')
        for field in ['description', 'allergen_review', 'image_url', 'social_url']:
            require(isinstance(menu[field], str), f'{name}: invalid {field}.')
        for field in ['image_url', 'social_url']:
            require(not menu[field] or (len(menu[field]) <= 200 and urllib.parse.urlsplit(menu[field]).scheme in {'http', 'https'}), f'{name}: invalid {field}.')
        recipe = menu['ingredients']
        require(isinstance(recipe, list) and recipe, f'{name}: recipe is empty.')
        seen = set()
        for ingredient in recipe:
            require(set(ingredient) == {'raw_material', 'quantity_required'}, f'{name}: invalid ingredient fields.')
            key = ingredient['raw_material'].strip().casefold()
            require(key in materials and key not in seen, f'{name}: missing or duplicate material {key}.')
            require(decimal_value(ingredient['quantity_required'], '0.001', 10, 3), f'{name}: invalid recipe quantity.')
            seen.add(key)
        tasks = menu['preparation_tasks']
        require(isinstance(tasks, list) and 0 < len(tasks) <= 20, f'{name}: invalid step list.')
        for task in tasks:
            require(set(task) == {'name', 'resource', 'minutes', 'additional_batch_minutes', 'max_wait_minutes', 'worker', 'overnight', 'independent_batches'}, f'{name}: missing or unsupported step fields.')
            require(isinstance(task.get('name'), str) and 0 < len(task['name'].strip()) <= 80, f'{name}: invalid step name.')
            require(task.get('resource') in RESOURCES, f'{name}: invalid resource.')
            for field, low, high in [('minutes', 1, 43200), ('additional_batch_minutes', 0, 43200), ('max_wait_minutes', 0, 10080)]:
                require(type(task.get(field)) is int and low <= task[field] <= high, f'{name}: invalid step {field}.')
            for field in ['worker', 'overnight', 'independent_batches']:
                require(type(task.get(field)) is bool, f'{name}: invalid step {field}.')
            require(not task['overnight'] or (not task['worker'] and task['resource'] in {'fridge', 'none'}), f'{name}: invalid overnight step.')
        require(len({task['independent_batches'] for task in tasks}) == 1, f'{name}: inconsistent batch mode.')


class NoRedirect(urllib.request.HTTPRedirectHandler):
    def redirect_request(self, req, fp, code, msg, headers, newurl):
        return None


class StaffAPI:
    def __init__(self, base_url, username, password, allow_local_http=False):
        parsed = urllib.parse.urlsplit(base_url)
        require(parsed.scheme == 'https' or (allow_local_http and parsed.scheme == 'http' and parsed.hostname in {'localhost', '127.0.0.1'}), 'Use HTTPS, or explicitly allow local HTTP for local testing.')
        require(parsed.hostname and not parsed.username and not parsed.password and parsed.path in {'', '/'} and not parsed.query and not parsed.fragment, 'Provide an origin URL without credentials, paths or queries.')
        self.base_url = base_url.rstrip('/')
        self.cookies = http.cookiejar.CookieJar()
        self.opener = urllib.request.build_opener(urllib.request.HTTPCookieProcessor(self.cookies), NoRedirect())
        self.request('GET', 'check-auth/')
        self.request('POST', 'login/', {'username': username, 'password': password})
        auth = self.request('GET', 'check-auth/')
        require(auth.get('authenticated') and auth.get('is_admin'), 'An authenticated Django staff account is required.')

    def request(self, method, path, data=None):
        headers = {'Accept': 'application/json'}
        body = None
        if data is not None:
            body = json.dumps(data).encode('utf-8')
            headers.update({'Content-Type': 'application/json', 'Origin': self.base_url, 'Referer': self.base_url + '/'})
            csrf = next((cookie.value for cookie in self.cookies if cookie.name == 'csrftoken'), '')
            require(csrf, 'The application did not issue a CSRF cookie.')
            headers['X-CSRFToken'] = csrf
        request = urllib.request.Request(self.base_url + '/api/' + path, body, headers, method=method)
        try:
            with self.opener.open(request, timeout=45) as response:
                return json.load(response)
        except urllib.error.HTTPError as exc:
            # Never log request bodies, login responses, cookies or credentials.
            raise ImportErrorDetail(f'{method} {path}: HTTP {exc.code}. Stopped; inspect the application and rerun the read-only plan.') from None
        except (urllib.error.URLError, TimeoutError, json.JSONDecodeError):
            raise ImportErrorDetail(f'{method} {path}: request failed. No automatic retry; rerun the read-only plan to reconcile any completed write.') from None


def rows(api, path):
    value = api.request('GET', path)
    require(isinstance(value, list), f'{path}: expected an unpaginated list; refusing to import a partial catalogue.')
    return value


def menu_payload(menu, categories, materials, new_status=None):
    payload = deepcopy(menu)
    allergen = payload.pop('allergen_review')
    payload['description'] = f'{payload["description"]} Allergen information: {allergen}'
    payload['category'] = categories[payload['category'].casefold()]['id']
    payload['ingredients'] = [
        {'raw_material': materials[item['raw_material'].casefold()]['id'], 'quantity_required': item['quantity_required']}
        for item in payload['ingredients']
    ]
    if new_status is not None:
        payload['selling_status'] = new_status
    return payload


def matches(actual, desired):
    for key, value in desired.items():
        other = actual.get(key)
        if key == 'ingredients':
            normalize = lambda recipe: sorted((row['raw_material'], Decimal(str(row['quantity_required']))) for row in recipe)
            if normalize(other or []) != normalize(value):
                return False
        elif key in {'price', 'packaging_cost', 'estimated_unit_cost'}:
            if other is None or Decimal(str(other)) != Decimal(str(value)):
                return False
        elif other != value:
            return False
    return True


def preflight(api, source, archive_other_menus=False, new_menu_status='paused'):
    validate_source(source)
    snapshot = {key: rows(api, path) for key, path in [
        ('categories', 'categories/'), ('materials', 'admin/raw-materials/'), ('products', 'products/')
    ]}
    categories = index_names(snapshot['categories'], 'live category')
    materials = index_names(snapshot['materials'], 'live material')
    products = index_names(snapshot['products'], 'live product')
    for material in source['raw_materials']:
        existing = materials.get(material['name'].casefold())
        require(not existing or existing['unit'] == material['unit'], f'{material["name"]}: existing unit differs from {material["unit"]}. No unit conversion or renaming will be performed.')
    targets = {menu['name'].casefold() for menu in source['menus']}
    plan = {
        'new_categories': sorted({menu['category'] for menu in source['menus'] if menu['category'].casefold() not in categories}),
        'new_materials': [m['name'] for m in source['raw_materials'] if m['name'].casefold() not in materials],
        'updated_materials': [m['name'] for m in source['raw_materials'] if m['name'].casefold() in materials and not matches(materials[m['name'].casefold()], m)],
        'new_menus': [m['name'] for m in source['menus'] if m['name'].casefold() not in products],
        'new_menu_status': new_menu_status,
        'menus_to_reconcile': [m['name'] for m in source['menus'] if m['name'].casefold() in products],
        'archive_products': [{'id': p['id'], 'name': p['name']} for p in snapshot['products'] if archive_other_menus and p['name'].casefold() not in targets and p['selling_status'] != 'archived'],
        'recipe_links': sum(len(m['ingredients']) for m in source['menus']),
        'inventory_batches_to_create': 0,
        'old_categories_and_materials': 'Retained to preserve historical references.',
    }
    return snapshot, plan


def apply_catalogue(api, source, snapshot, plan, record=lambda event: None):
    """Create/verify new catalogue before archiving reviewed old product IDs."""
    categories = index_names(snapshot['categories'], 'category')
    materials = index_names(snapshot['materials'], 'material')
    products = index_names(snapshot['products'], 'product')

    def save(path, existing, payload):
        if existing is not None and matches(existing, payload):
            return existing
        method, url = ('PATCH', f'{path}{existing["id"]}/') if existing is not None else ('POST', path)
        result = api.request(method, url, payload)
        record({'method': method, 'path': url, 'id': result['id'], 'name': result['name']})
        verified = api.request('GET', f'{path}{result["id"]}/')
        require(matches(verified, payload), f'{result["name"]}: saved fields did not verify. Old menus have not all been archived; inspect the receipt.')
        return verified

    for name in sorted({menu['category'] for menu in source['menus']}):
        key = name.casefold()
        if key not in categories:
            categories[key] = save('categories/', None, {'name': name})
    for material in source['raw_materials']:
        key = material['name'].casefold()
        materials[key] = save('admin/raw-materials/', materials.get(key), material)
    for menu in source['menus']:
        key = menu['name'].casefold()
        existing = products.get(key)
        # The guide does not override existing selling state, weekdays or AI summaries.
        payload = menu_payload(menu, categories, materials, None if existing else plan['new_menu_status'])
        products[key] = save('products/', existing, payload)
    for product in plan['archive_products']:
        # Recheck the record before archiving; never rename a concurrently edited item.
        current = api.request('GET', f'products/{product["id"]}/')
        original = next(row for row in snapshot['products'] if row['id'] == product['id'])
        require(current == original, f'{product["name"]}: changed since the plan. Stopped before archiving this product.')
        save('products/', current, {'selling_status': 'archived'})
    return {'menus_verified': len(source['menus']), 'materials_verified': len(source['raw_materials']), 'recipe_links_verified': plan['recipe_links'], 'archived': len(plan['archive_products']), 'inventory_batches_created': 0}


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--source', type=Path, default=SOURCE)
    parser.add_argument('--url', default='https://preorder-freshness.vercel.app')
    parser.add_argument('--check', action='store_true', help='Validate the source only; no authentication or network.')
    parser.add_argument('--apply', action='store_true', help='Apply; otherwise print a read-only plan.')
    parser.add_argument('--archive-other-menus', action='store_true')
    parser.add_argument('--new-menu-status', choices=['active', 'paused'], default='paused')
    parser.add_argument('--allow-local-http', action='store_true')
    parser.add_argument('--report-dir', type=Path, default=Path(tempfile.gettempdir()) / 'dapur-kita-import')
    args = parser.parse_args()
    try:
        source = json.loads(args.source.read_text(encoding='utf-8'))
        validate_source(source)
        if args.check:
            print(json.dumps({'menus': len(source['menus']), 'materials': len(source['raw_materials']), 'categories': sorted({m['category'] for m in source['menus']}), 'recipe_links': sum(len(m['ingredients']) for m in source['menus']), 'inventory_imported': False}, indent=2))
            return 0
        username, password = (os.getenv(name) for name in ['DJANGO_STAFF_USERNAME', 'DJANGO_STAFF_PASSWORD'])
        require(username and password, 'Set DJANGO_STAFF_USERNAME and DJANGO_STAFF_PASSWORD securely; never use the Vercel token as a Django login.')
        api = StaffAPI(args.url, username, password, args.allow_local_http)
        snapshot, plan = preflight(api, source, args.archive_other_menus, args.new_menu_status)
        print(json.dumps(plan, indent=2))
        if not args.apply:
            return 0
        stamp = datetime.now(timezone.utc).strftime('%Y%m%dT%H%M%S%fZ')
        args.report_dir.mkdir(parents=True, exist_ok=True)
        report = args.report_dir / f'{stamp}.json'
        receipt = {'origin': args.url, 'source': str(args.source), 'before': snapshot, 'plan': plan, 'events': [], 'status': 'in_progress'}

        def record(event=None):
            if event is not None:
                receipt['events'].append(event)
            with report.open('w', encoding='utf-8') as handle:
                os.chmod(report, 0o600)
                json.dump(receipt, handle, indent=2)
                handle.write('\n')

        record()
        try:
            receipt['result'] = apply_catalogue(api, source, snapshot, plan, record)
            receipt['status'] = 'completed'
        except Exception:
            receipt['status'] = 'stopped_partial_changes_possible'
            raise
        finally:
            record()
            print(f'Catalogue snapshot and write receipt: {report}')
        print(json.dumps(receipt['result'], indent=2))
        return 0
    except (ImportErrorDetail, KeyError, ValueError, TypeError, OSError) as exc:
        print(f'Import stopped: {exc}')
        return 1


if __name__ == '__main__':
    raise SystemExit(main())
