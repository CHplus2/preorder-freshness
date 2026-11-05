"""Build the owner-run catalogue import from its reviewed JSON (no DB access)."""
import json
from pathlib import Path

ROOT = Path(__file__).resolve().parent


def build():
    catalogue = json.loads((ROOT / 'data/wrap_bowl_kuch.json').read_text())
    payload = json.dumps(catalogue, ensure_ascii=False, separators=(',', ':'))
    if '$wb_catalogue$' in payload:
        raise ValueError('Catalogue contains the reserved SQL quote delimiter.')
    return (ROOT / 'wrap_bowl_catalogue.template.sql').read_text().replace('/*CATALOGUE_JSON*/', payload)


def build_refresh():
    catalogue = json.loads((ROOT / 'data/wrap_bowl_kuch.json').read_text())
    catalogue['operations'] = json.loads((ROOT / 'data/wrap_bowl_operations.json').read_text())
    payload = json.dumps(catalogue, ensure_ascii=False, separators=(',', ':'))
    if '$wb_refresh_data$' in payload:
        raise ValueError('Reserved SQL quote delimiter in refresh data.')
    return (ROOT / 'wrap_bowl_refresh.template.sql').read_text().replace('/*REFRESH_JSON*/',payload)


if __name__ == '__main__':
    destination = ROOT / 'sql/apply_wrap_bowl_catalogue.sql'
    destination.write_text(build())
    print(f'Wrote {destination.relative_to(ROOT.parent)}')

    target = ROOT / 'sql/refresh_wrap_bowl_operations.sql'
    target.write_text(build_refresh())
    print(f'Wrote {target.relative_to(ROOT.parent)}')
