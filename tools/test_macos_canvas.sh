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
  clang++ -std=c++17 -O2 -fno-omit-frame-pointer "$ROOT/tests/$fixture.cpp" -o "$OUT/$fixture"
  "$OUT/$fixture"
  printf 'PASS %s (synthetic fixture, not host UI acceptance)\n' "$fixture"
done
python3 -B -m unittest discover -s "$ROOT/tests" -p 'test_graph_contract.py'
