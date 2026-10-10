#!/bin/sh
set -eu
# No migrate command here: deployment startup must not mutate the database.
if [ -n "${FRESHCAST_BUNDLE_URL:-}" ]; then
    bundle_root="${FRESHCAST_BUNDLE_ROOT:-/tmp/freshcast-${FRESHCAST_BUNDLE_SHA256:?Set FRESHCAST_BUNDLE_SHA256}}"
    if [ ! -f "$bundle_root/artifacts/demand_model.cbm" ]; then
        python backend/predictive_ai/provision_bundle.py --destination "$bundle_root"
    fi
    export PREDICTIVE_DATA_DIR="$bundle_root/data"
    export PREDICTIVE_ARTIFACT_DIR="$bundle_root/artifacts"
fi
exec gunicorn app:application --bind "0.0.0.0:${PORT:-8000}" --workers 1 --threads 2 --timeout 120 --access-logfile - --error-logfile -
