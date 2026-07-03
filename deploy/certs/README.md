# TLS certificates

nginx (the `web` service) terminates HTTPS with the cert/key placed here:

- `atlas.crt` — certificate (PEM)
- `atlas.key` — private key (PEM)

These are **git-ignored** (never commit private keys).

## Local / for now (self-signed `localhost`)
```
sh deploy/gen-dev-cert.sh
```
Browsers will warn on the self-signed cert — that's expected locally.

## Production
Drop your real certificate here with the same filenames (`atlas.crt` /
`atlas.key`). When your domain's A record is ready, reissue the cert for that
hostname and register `https://<your-domain>` as the SPA redirect URI in Entra.
