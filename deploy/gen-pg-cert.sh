#!/usr/bin/env sh
# Generate a dev CA + server cert + client cert for PASSWORDLESS Postgres auth
# (TLS client-certificate / mutual TLS). With this the app authenticates to the
# database by presenting a client certificate whose CN is the DB role name —
# there is NO password to store or vault. See docs/postgres-cert-auth.md.
#
# Output → deploy/pgcerts/:
#   ca.crt  ca.key         — the dev certificate authority
#   server.crt server.key  — the Postgres server's TLS cert (SAN = the DB host)
#   client.crt client.key  — the app's client cert (CN = the DB role, default atlas)
#
# Usage:  sh deploy/gen-pg-cert.sh [db-host] [db-role]
#   db-host  DNS/host the app connects to (default: db — the compose service name)
#   db-role  Postgres login the client cert authenticates as (default: atlas)
#
# ⚠️ Dev certificates. For production, mint the server/client certs from your own
#    CA (corporate PKI) with the same CNs/SAN and drop them in with these names.
set -e

DIR="$(dirname "$0")/pgcerts"
HOST="${1:-db}"
ROLE="${2:-atlas}"
DAYS=825
# Bind-mounts preserve host uid, so owning each private key by the uid that reads
# it (0600) avoids any entrypoint permission hack:
#   • server.key → postgres in postgres:16-alpine (uid 70)
#   • client.key → the non-root API/worker user in the Atlas image (uid 1654)
PG_UID=70
APP_UID=1654

mkdir -p "$DIR"
cd "$DIR"

# --- CA -------------------------------------------------------------------
openssl req -x509 -nodes -newkey rsa:4096 -days $DAYS \
  -keyout ca.key -out ca.crt -subj "/CN=Atlas Dev Postgres CA"

# --- Server cert (SAN = host) --------------------------------------------
openssl req -nodes -newkey rsa:2048 -keyout server.key -out server.csr -subj "/CN=$HOST"
openssl x509 -req -in server.csr -CA ca.crt -CAkey ca.key -CAcreateserial \
  -days $DAYS -out server.crt \
  -extfile /dev/stdin <<EOF
subjectAltName = DNS:$HOST,DNS:localhost,IP:127.0.0.1
EOF

# --- Client cert (CN = DB role — this is what Postgres authenticates as) --
openssl req -nodes -newkey rsa:2048 -keyout client.key -out client.csr -subj "/CN=$ROLE"
openssl x509 -req -in client.csr -CA ca.crt -CAkey ca.key -CAcreateserial \
  -days $DAYS -out client.crt

rm -f server.csr client.csr ca.srl

# --- Permissions ----------------------------------------------------------
# Private keys must not be group/world readable or Postgres/Npgsql refuse them.
chmod 600 ca.key server.key client.key
chmod 644 ca.crt server.crt client.crt
# Let each container user read its key over the bind mount (needs root to chown).
if ! { chown "$PG_UID" server.key && chown "$APP_UID" client.key; } 2>/dev/null; then
  echo "  (note: run as root to chown server.key→$PG_UID and client.key→$APP_UID for the containers; see docs)"
fi

echo "Wrote CA + server + client certs to $DIR"
echo "  server cert CN/SAN: $HOST (+ localhost, 127.0.0.1)"
echo "  client cert CN:     $ROLE   ← must equal the Postgres login role"
echo "Next: docs/postgres-cert-auth.md (pg_hba + the passwordless connection string)."
