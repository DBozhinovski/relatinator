#!/usr/bin/env bash
# Seeding script of the workerd benchmark. Usage:
#   seed-size.sh <site> <seed.json> <state-dir>
# Builds the site with <seed.json>, starts `astro preview` (local
# workerd and local D1), runs the EmDash setup with the sample content,
# and copies the seeded D1 state to <state-dir>. PORT sets the port
# (default 4399). On each exit, the script stops the server and puts
# back the seed/seed.json of the site.
set -euo pipefail
site=$1
seed=$(realpath "$2")
state=$(realpath -m "$3")
port=${PORT:-4399}
url="http://localhost:$port"
setup='{"title":"Bench Blog","includeContent":true}'

cd "$site"
cp seed/seed.json seed/seed.bench-backup.json
cleanup() {
  npx astro preview stop > /dev/null 2>&1 || true
  mv seed/seed.bench-backup.json seed/seed.json
}
trap cleanup EXIT
cp "$seed" seed/seed.json
rm -rf .wrangler dist
npx astro build > /dev/null
npx astro preview --port "$port" > /dev/null 2>&1
until curl -s -o /dev/null "$url/"; do sleep 0.5; done
# The setup seeds the content in steps. Each request does one step.
for _ in $(seq 1 200); do
  result=$(curl -s -X POST -H 'content-type: application/json' -d "$setup" "$url/_emdash/api/setup")
  if grep -q '"seedComplete":true' <<< "$result"; then break; fi
  if ! grep -q '"seedComplete":false' <<< "$result"; then
    echo "setup error: $result" >&2
    exit 1
  fi
done
npx astro preview stop
sleep 1
rm -rf "$state"
cp -a .wrangler/state "$state"
