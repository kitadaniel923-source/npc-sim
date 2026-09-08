#!/usr/bin/env bash
set -euo pipefail

# Everglen architecture ownership gate.
# Run from repository root. Archived code is excluded from runtime checks.

tracked_js=$(git ls-files '*.js' ':!archive/**')

bad_input=$(printf '%s\n' "$tracked_js" | xargs grep -nH "canvas\.addEventListener" -- || true)
if [[ -n "$bad_input" ]]; then
  bad=$(printf '%s\n' "$bad_input" | grep -v '^input_dispatcher\.js:' || true)
  if [[ -n "$bad" ]]; then
    echo "FAIL: world-canvas listeners exist outside input_dispatcher.js"
    echo "$bad"
    exit 1
  fi
fi

# Renderer timers are forbidden in production feature files.
bad_render_timers=$(printf '%s\n' "$tracked_js" | xargs grep -nHE "setInterval\([^\n]*(draw|SIM_RENDER|EVERGLEN_RENDER)" -- || true)
if [[ -n "$bad_render_timers" ]]; then
  echo "FAIL: independent renderer timer/loop found"
  echo "$bad_render_timers"
  exit 1
fi

# The simulation may own the simulation scheduler, but its redraw call must
# cross the canonical window.SIM_RENDER seam so registered render stages run.
bad_sim_render=$(grep -nE '[;}][[:space:]]*render\(\)' simulation.js || true)
if [[ -n "$bad_sim_render" ]]; then
  echo "FAIL: simulation.js bypasses the canonical render registry"
  echo "$bad_sim_render"
  exit 1
fi
if ! grep -nF 'function renderNow(){return typeof window.SIM_RENDER' simulation.js >/dev/null; then
  echo "FAIL: simulation.js is missing the registry-aware render seam"
  exit 1
fi

# Retired production modules must not be loaded.
if grep -nE 'spawn_system\.js|world_persistence\.js|world_persistence_v2\.js' index.html >/dev/null; then
  echo "FAIL: retired module is still loaded by index.html"
  exit 1
fi

echo "PASS: input/render ownership gate"
echo "PASS: simulation render-registry seam gate"
echo "PASS: retired-module load gate"
echo "Deferred: inspector DOM ownership and legacy simulation timers"
