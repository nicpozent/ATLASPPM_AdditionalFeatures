#!/usr/bin/env bash
# ============================================================================
#  Emit the Atlas API's OpenAPI v1 document to server/openapi/atlas-v1.json.
#
#  The frontend generates its API types from this file (openapi-typescript →
#  src/api/generated.ts). See ADR-0081 / #97. Swashbuckle's `dotnet swagger
#  tofile` doesn't understand this project's minimal-API top-level Program, so
#  we take the reliable route: boot the app briefly and read the document it
#  actually serves at /swagger/v1/swagger.json.
#
#  No database is required — Atlas__SkipDbInit=true skips the migrate/seed
#  block (endpoints still map, so the document is complete). Runs in the
#  Development environment with auth disabled so the anonymous-in-Production
#  boot fuse doesn't trip.
# ============================================================================
set -euo pipefail

SERVER_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
OUT="${SERVER_DIR}/openapi/atlas-v1.json"
PORT="${OPENAPI_PORT:-5199}"
CONFIG="${OPENAPI_CONFIG:-Debug}"
DLL="${SERVER_DIR}/bin/${CONFIG}/net10.0/Atlas.Api.dll"

echo "openapi: building Atlas.Api ($CONFIG)…"
dotnet build "${SERVER_DIR}/Atlas.Api.csproj" -c "$CONFIG" -v q --nologo

echo "openapi: booting API on :$PORT (no DB)…"
Atlas__SkipDbInit=true \
ASPNETCORE_ENVIRONMENT=Development \
ASPNETCORE_URLS="http://127.0.0.1:${PORT}" \
Auth__Enabled=false \
ConnectionStrings__Postgres="Host=openapi-none;Database=none;Username=none;Password=none" \
  dotnet "$DLL" >/tmp/atlas-openapi-boot.log 2>&1 &
APP_PID=$!
# Always reap the app, even on failure.
trap 'kill "$APP_PID" 2>/dev/null || true; wait "$APP_PID" 2>/dev/null || true' EXIT

for _ in $(seq 1 60); do
  if curl -sf "http://127.0.0.1:${PORT}/health" >/dev/null 2>&1; then break; fi
  sleep 0.5
done

if ! curl -sf "http://127.0.0.1:${PORT}/health" >/dev/null 2>&1; then
  echo "openapi: API did not become healthy — boot log:" >&2
  cat /tmp/atlas-openapi-boot.log >&2
  exit 1
fi

curl -sf "http://127.0.0.1:${PORT}/swagger/v1/swagger.json" -o "$OUT"
echo "openapi: wrote $OUT ($(wc -c <"$OUT") bytes)"
