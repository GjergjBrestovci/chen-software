#!/usr/bin/env bash
# Runs every script in fixtures/sql/ against a real MySQL 8.4, in a throwaway
# container, and fails if MySQL rejects any statement. The unit tests prove the
# export writes exactly these files; this proves MySQL accepts them.
#
# Needs podman or docker. Usage: npm run verify:sql
set -euo pipefail

cd "$(dirname "$0")/.."

engine="$(command -v podman || command -v docker || true)"
if [[ -z "$engine" ]]; then
  echo "verify:sql needs podman or docker." >&2
  exit 1
fi

container="chenlab-verify-sql-$$"
password="chenlab"
mysql=(mysql --user=root --password="$password" --silent --skip-column-names)

cleanup() { "$engine" rm --force "$container" >/dev/null 2>&1 || true; }
trap cleanup EXIT

"$engine" run --detach --rm --name "$container" \
  --env MYSQL_ROOT_PASSWORD="$password" docker.io/library/mysql:8.4 >/dev/null

echo "Waiting for MySQL..."
for _ in $(seq 1 90); do
  if "$engine" exec "$container" "${mysql[@]}" --execute='SELECT 1' >/dev/null 2>&1; then
    break
  fi
  sleep 2
done

run() { "$engine" exec --interactive "$container" "${mysql[@]}" "$@" 2> >(grep -v 'Using a password' >&2); }

status=0
for file in fixtures/sql/*.sql; do
  database="$(basename "$file" .sql | tr -c 'a-zA-Z0-9\n' '_')"
  run --execute="CREATE DATABASE \`$database\`"
  if ! run "$database" < "$file"; then
    echo "FAIL  $file" >&2
    status=1
    continue
  fi
  # A script that drops its tables first must also survive being run again.
  if grep -q '^DROP TABLE IF EXISTS' "$file" && ! run "$database" < "$file"; then
    echo "FAIL  $file (second run)" >&2
    status=1
    continue
  fi
  counts="$(run --execute="SELECT
      (SELECT COUNT(*) FROM information_schema.tables WHERE table_schema = '$database'),
      (SELECT COUNT(*) FROM information_schema.referential_constraints WHERE constraint_schema = '$database')")"
  read -r tables keys <<<"$counts"
  echo "ok    $file: $tables tables, $keys foreign keys"
done

exit "$status"
