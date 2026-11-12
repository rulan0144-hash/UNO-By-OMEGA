#!/bin/bash
# Menyalin js/ ke folder sementara bertipe ES module lalu menjalankan sim_allwild.mjs
set -e
HERE="$(cd "$(dirname "$0")" && pwd)"
T=$(mktemp -d); cp -r "$HERE/../js" "$T/js"; echo '{"type":"module"}' > "$T/package.json"
node "$HERE/sim_allwild.mjs" "$T"
