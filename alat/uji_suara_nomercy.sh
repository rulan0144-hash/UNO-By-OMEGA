#!/bin/bash
# Uji suara No Mercy di Node (AudioContext palsu): efek baru menjadwalkan bunyi tanpa NaN, lagu 'nomercy' berjalan.   Pakai:  bash alat/uji_suara_nomercy.sh
D=$(mktemp -d); R="$(cd "$(dirname "$0")/.." && pwd)"
cp "$R/js/core/sound.js" "$D/sound.mjs"; cp "$R/alat/uji_suara_nomercy.mjs" "$D/test.mjs"; echo '{"type":"module"}' > "$D/package.json"
(cd "$D" && node test.mjs ./sound.mjs)
