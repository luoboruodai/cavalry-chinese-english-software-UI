#!/usr/bin/env bash
# Deterministic UTF-8/Canvas/Lina tests only; never starts or attaches to Cavalry.
set -euo pipefail
if [ "$(uname -s)" != Darwin ]; then
  echo "macOS is required for the private-ABI fixture; no host test was performed." >&2
  exit 1
fi
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
OUT="${CB_TEST_OUTPUT:-$(mktemp -d)}"
mkdir -p "$OUT"
for fixture in text_runs canvas_renderer graph_measure viewport_names; do
  clang++ -std=c++17 -O2 -fno-omit-frame-pointer "$ROOT/tests/$fixture.cpp" -o "$OUT/$fixture" -framework CoreText -framework CoreFoundation
  "$OUT/$fixture"
  printf 'PASS %s (synthetic fixture, not host UI acceptance)\n' "$fixture"
done
clang++ -std=c++17 -O2 -fno-omit-frame-pointer -DCAVALRY_I18N_CAVALRY_280=1 "$ROOT/tests/canvas_renderer.cpp" -o "$OUT/canvas_renderer_280" -framework CoreText -framework CoreFoundation
"$OUT/canvas_renderer_280"
printf 'PASS canvas_renderer_280 (2.8 contract fixture, not host UI acceptance)\n'
clang++ -std=c++17 -O2 -fno-omit-frame-pointer -DCAVALRY_I18N_CAVALRY_280=1 "$ROOT/tests/graph_measure.cpp" -o "$OUT/graph_measure_280" -framework CoreText -framework CoreFoundation
"$OUT/graph_measure_280"
printf 'PASS graph_measure_280 (2.8 contract fixture, not host UI acceptance)\n'
python3 -B -m unittest discover -s "$ROOT/tests" -p 'test_graph_contract.py'
