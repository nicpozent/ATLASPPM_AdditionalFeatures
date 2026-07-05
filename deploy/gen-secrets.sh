#!/usr/bin/env sh
# Generate the Docker-secret files used by docker-compose.secrets.yml:
#   secrets/db_password.txt  — the PostgreSQL password
#   secrets/pg_conn.txt      — the full connection string the API reads
#
# By default a strong random password is generated. To keep your EXISTING
# database password (recommended when the atlas_db volume already exists — see
# the gotcha in docs/secrets.md), pass it in:
#
#   sh deploy/gen-secrets.sh                 # new random password
#   sh deploy/gen-secrets.sh 'ExistingPass'  # reuse a known password
#
# Then:
#   docker compose -f docker-compose.yml -f docker-compose.secrets.yml up -d
set -e

DIR="$(dirname "$0")/../secrets"
mkdir -p "$DIR"

DB_USER="${POSTGRES_USER:-atlas}"
DB_NAME="${POSTGRES_DB:-atlas}"

if [ -n "$1" ]; then
  PW="$1"
else
  # 32 URL-safe characters; openssl is already required by gen-dev-cert.sh.
  PW="$(openssl rand -base64 24 | tr -d '/+=' | cut -c1-32)"
fi

# printf (not echo) so no trailing newline ends up inside the secret value.
printf '%s' "$PW" > "$DIR/db_password.txt"
printf '%s' "Host=db;Port=5432;Database=$DB_NAME;Username=$DB_USER;Password=$PW" > "$DIR/pg_conn.txt"
chmod 600 "$DIR/db_password.txt" "$DIR/pg_conn.txt"

echo "Wrote $DIR/db_password.txt and $DIR/pg_conn.txt (chmod 600, git-ignored)."
echo "User=$DB_USER Database=$DB_NAME"
if [ -z "$1" ]; then
  echo "A new random password was generated. If the atlas_db volume already"
  echo "exists, either re-run with your current password, or rotate the role:"
  echo "  docker compose exec db psql -U $DB_USER -c \"ALTER USER $DB_USER PASSWORD '<new>';\""
fi
