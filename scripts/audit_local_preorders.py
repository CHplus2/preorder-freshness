"""Read-only local-demand preparation. Never writes business data or trains."""
import argparse
import csv
import hashlib
import json
import os
from pathlib import Path
import sys
from datetime import datetime, timezone

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))
from backend.predictive_ai.local_preorders import PROVENANCE, audit, normalize_snapshot, snapshot
from import_dapur_kita import StaffAPI, rows


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    source = parser.add_mutually_exclusive_group(required=True)
    source.add_argument('--base-url', help='Staff-authenticated HTTPS application origin')
    source.add_argument('--snapshot', type=Path, help='Previously exported minimal JSON; no network needed')
    parser.add_argument('--provenance', choices=sorted(PROVENANCE))
    parser.add_argument('--catalogue-relabelled', action='store_true')
    parser.add_argument('--output-dir', type=Path, required=True, help='New or empty private output directory')
    args = parser.parse_args()
    output = args.output_dir.resolve()
    if output.exists() and any(output.iterdir()):
        parser.error('Output directory must be empty; preserve previous exports.')
    if args.snapshot:
        if args.provenance or args.catalogue_relabelled:
            parser.error('Offline replay preserves the saved provenance; do not override it.')
        data = normalize_snapshot(json.loads(args.snapshot.read_text()))
    else:
        if not args.provenance:
            parser.error('Explicit --provenance is required for live data.')
        if not all(os.environ.get(k) for k in ('DJANGO_STAFF_USERNAME', 'DJANGO_STAFF_PASSWORD')):
            parser.error('Set the staff credentials in secure environment settings, not command arguments.')
        api = StaffAPI(args.base_url, os.environ['DJANGO_STAFF_USERNAME'], os.environ['DJANGO_STAFF_PASSWORD'])
        data = snapshot(rows(api, 'admin/orders/'), rows(api, 'products/'),
                        as_of=datetime.now(timezone.utc).isoformat(), provenance=args.provenance,
                        catalogue_relabelled=args.catalogue_relabelled)
    report, observations = audit(data)
    encoded = (json.dumps(data, sort_keys=True, indent=2) + '\n').encode()
    report['snapshot_sha256'] = hashlib.sha256(encoded).hexdigest()
    output.mkdir(parents=True, exist_ok=True, mode=0o700)
    output.chmod(0o700)
    for name, body in [('snapshot.json', encoded), ('readiness.json', (json.dumps(report, indent=2) + '\n').encode())]:
        path = output / name
        path.write_bytes(body)
        path.chmod(0o600)
    path = output / 'eligible_delivery_history.csv'
    with path.open('w', newline='') as handle:
        writer = csv.DictWriter(handle, fieldnames=['week_start', 'product_id', 'observed_portions'])
        writer.writeheader()
        writer.writerows(observations)
    path.chmod(0o600)
    print(json.dumps(report, indent=2))
    print(f'Private preparation files: {output}')
    # A blocked audit is a valid report, but must stop a chained training job.
    return 2 if report['training_status'] == 'blocked' else 0


if __name__ == '__main__':
    raise SystemExit(main())
