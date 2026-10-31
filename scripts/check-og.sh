#!/usr/bin/env bash
# Renders real OG images through a running `npm run dev` (fonts come from Google Fonts, so this needs the network)
# and checks each is a PNG under 300 KB. Usage: scripts/check-og.sh [out_dir]
set -euo pipefail
BASE=${BASE:-http://localhost:8787}
OUT=${1:-$(mktemp -d)}
LIMIT=$((300 * 1024))
status=0
for team in flamengo vasco sao-paulo; do
  file="$OUT/$team.png"
  curl -fsS "$BASE/$team/og.png" -o "$file"
  bytes=$(wc -c < "$file")
  magic=$(head -c 4 "$file" | od -An -tx1 | tr -d ' \n')
  if [ "$magic" = "89504e47" ] && [ "$bytes" -lt "$LIMIT" ]; then
    echo "ok   $team $bytes bytes -> $file"
  else
    echo "FAIL $team $bytes bytes, magic $magic -> $file"; status=1
  fi
done
exit $status
