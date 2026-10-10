#!/usr/bin/env bash
# Download verified public inputs, recreate training, evaluate, generate demo inputs.
set -euo pipefail
cd "$(dirname "$0")/../.."
export UV_CACHE_DIR="${UV_CACHE_DIR:-/workspace/.cache/uv}"
ml_environment="${ML_ENV_DIR:-/workspace/venv-ml}"
uv venv --python 3.12 --allow-existing "$ml_environment"
uv pip sync --python "$ml_environment/bin/python" backend/predictive_ai/requirements-ml.lock
mkdir -p backend/predictive_ai/data
source_base=https://raw.githubusercontent.com/devarti19/Food-Demand-Forecasting/master
for name in train.csv meal_info.csv fulfilment_center_info.csv; do
    target="backend/predictive_ai/data/$name"
    if test ! -f "$target"; then
        curl --fail --location --retry 2 --output "$target.download" "$source_base/$name"
        mv "$target.download" "$target"
    fi
done
"$ml_environment/bin/python" - <<'PY'
import hashlib
from pathlib import Path
expected={'train.csv':'a2ed2d7c6905d63a9361d8dd35bc06c8a597831f7185644e0f33ad7bfe20cc81',
'meal_info.csv':'9d8045af391c492f531c928d7f3d58581c80d0594776d1f4e53c8b29bbff8f75',
'fulfilment_center_info.csv':'c874f74fa392b2c4dd24a167f32a5bee68a444b8bf151acf295cd5d66aa0517f'}
for name,digest in expected.items():
    actual=hashlib.sha256((Path('backend/predictive_ai/data')/name).read_bytes()).hexdigest()
    if actual!=digest: raise SystemExit(f'Checksum mismatch: {name}; inspect source, do not bypass verification.')
PY
"$ml_environment/bin/python" backend/predictive_ai/train_model.py
"$ml_environment/bin/python" -m backend.predictive_ai.evaluate_model
"$ml_environment/bin/python" backend/predictive_ai/generate_demo_inputs.py
"$ml_environment/bin/python" backend/predictive_ai/predict_week.py
