"""Vercel's glob string limits and the build/runtime file boundary."""
import json
from pathlib import Path
import subprocess
import unittest

ROOT = Path(__file__).resolve().parents[1]


class VercelConfigTests(unittest.TestCase):
    def test_function_file_globs_obey_schema_length_limit(self):
        config = json.loads((ROOT / 'vercel.json').read_text())
        for name, function in config['functions'].items():
            for field in ('includeFiles', 'excludeFiles'):
                with self.subTest(function=name, field=field):
                    self.assertIsInstance(function[field], str)
                    self.assertLessEqual(len(function[field]), 256)

    def test_compressed_glob_excludes_development_files_and_keeps_runtime_inputs(self):
        # Check real JS glob engines, rather than treating a brace glob as a
        # Python fnmatch expression (which would not expand the alternatives).
        script = r"""
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const {createRequire} = require('node:module');
const dependencies = createRequire(path.join(process.cwd(), 'frontend/package.json'));
const {minimatch} = dependencies('minimatch');
const picomatch = dependencies('picomatch');
const config = JSON.parse(fs.readFileSync('vercel.json', 'utf8')).functions['app.py'];
const excluded = [
 'frontend/node_modules/vite/index.js', 'backend/venv/lib/django/__init__.py',
 '.venv/lib/library.py', 'venv/lib/library.py', 'backend/backups/private.sql',
 'backend/db.sqlite3', 'screenshots/menu.png', '.git/config', 'tests/test_app.py',
 'escrow/contracts/PreorderEscrow.sol', 'docs/evidence/menu.png',
 '.freshcast-deploy/runtime-bundle.tar.gz', 'frontend/public/menu-images/food.jpg',
 'frontend/scripts/prepare-menu-photos.mjs', 'frontend/src/components/FoodCard.jsx',
 'frontend/src/contexts/AuthContext.js', 'frontend/src/features/predictive/LocalKitchen.jsx',
 'frontend/src/pages/customer/CheckoutPage.jsx', 'frontend/src/hooks/useCheckout.js',
 'frontend/src/utils/operationalOrders.js', 'frontend/src/assets/icon.svg',
 'backend/myapp/test_menu_stock.py', 'backend/predictive_ai/tests/test_model.py',
];
const retained = [
 'app.py', 'backend/config/settings.py', 'backend/myapp/services/menu_stock.py',
 'backend/myapp/migrations/0023_raw_material.py', 'frontend/dist/index.html',
 'frontend/dist/assets/index-12345678.js', 'frontend/dist/menu-images/food.webp',
 'frontend/src/contracts/preorderEscrow.json', 'backend/predictive_ai/data/train.csv',
 'backend/predictive_ai/artifacts/demand_model.cbm',
 'backend/predictive_ai/artifacts/metrics.json',
 'backend/predictive_ai/artifacts/runtime-bundle.tar.gz',
 'docs/DAPUR-KITA-STARTER-DATA.json', 'deploy/provision_vercel.py',
];
for (const matches of [file => minimatch(file, config.excludeFiles), picomatch(config.excludeFiles)]) {
 for (const file of excluded) assert.ok(matches(file), `Development file retained: ${file}`);
 for (const file of retained) assert.ok(!matches(file), `Required runtime file excluded: ${file}`);
}
for (const file of retained.filter(file => file.includes('predictive_ai/') || file.includes('/contracts/'))) {
 assert.ok(minimatch(file, config.includeFiles), `Required input not explicitly included: ${file}`);
}
"""
        result = subprocess.run(['node', '-e', script], cwd=ROOT, capture_output=True,
                                text=True, timeout=30)
        self.assertEqual(result.returncode, 0, result.stdout + result.stderr)
