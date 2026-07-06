# ADR-0005 — Microsoft Entra ID SSO, fail-fast on misconfiguration

**Status:** Accepted

## Context
Birgma/Biltema standardises on Microsoft Entra ID. Atlas must use corporate SSO
(with MFA) rather than manage its own credentials, and must never accidentally
serve unauthenticated in production.

## Decision
Delegate authentication to **Entra ID via OIDC/OAuth2**: MSAL redirect flow in the
SPA; the API validates the JWT **audience/issuer**. MFA is enforced by Entra
**Conditional Access** (Atlas honours it transparently). If auth is enabled but
misconfigured (missing tenant/audience) the API **fails fast at startup**. For
local/dev, auth is explicitly disabled (`VITE_AUTH_ENABLED=false`,
`Auth:Enabled=false`) and role is taken from an `X-Atlas-Role` header.

## Consequences
- **+** No password storage; central identity lifecycle, MFA, Conditional Access.
- **+** Fail-fast removes the "accidentally open" foot-gun.
- **+** Directory reuse (Graph) feeds people/onboarding.
- **−** Local dev must consciously run with auth off; documented.
- **−** Hard dependency on Entra availability for sign-in.

## Alternatives considered
- **Local auth / other IdP** — rejected: violates the corporate-SSO requirement.
