# Cloudflare Security Audit

## Fixed Critical/High findings

- Public room code could not be used as Durable Object identity.
- Browser cannot receive or route by Durable Object ID.
- Ticket consumption now occurs only after origin and session validation.
- WebSocket commands have strict runtime schemas and size limits.
- Active state is cloned before mutation and persisted before broadcast.
- Constructor re-entry repairs expected alarms.
- Test-only presets are rejected outside test environment.
- Turnstile verifies success, hostname and action with a timeout.
- Bundle/static scans reject secret names, debug truth and direct D1 access.

## Pending evidence

Official Workers runtime tests, deployed traffic scans and remote staging security tests require installed Cloudflare tooling and, for deployment, authenticated account access.
