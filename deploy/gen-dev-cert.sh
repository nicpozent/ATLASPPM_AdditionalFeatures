#!/usr/bin/env sh
# Generate a self-signed TLS cert for local HTTPS (https://localhost).
# For production, replace deploy/certs/atlas.crt and atlas.key with your real
# certificate (corporate CA / wildcard) — same filenames, no other changes.
#
# Usage:  sh deploy/gen-dev-cert.sh [extra-dns-name]
set -e
DIR="$(dirname "$0")/certs"
mkdir -p "$DIR"
openssl req -x509 -nodes -newkey rsa:2048 -days 825 \
  -keyout "$DIR/atlas.key" \
  -out "$DIR/atlas.crt" \
  -subj "/CN=localhost" \
  -addext "subjectAltName=DNS:localhost,DNS:${1:-localhost}"
echo "Wrote $DIR/atlas.crt and $DIR/atlas.key (self-signed, CN=localhost)."
