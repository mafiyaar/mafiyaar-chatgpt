# Cloudflare Execution Ledger

## 2026-07-23
- Verified immutable Architecture Lock SHA-256 `1d1b0ba736d8c6064c716694c3824db6731452ad10b2fc7e2e41d809138edf25`.
- Preserved the Node reference with a SHA-256 file manifest because no Git metadata was present.
- Executed the Node reference: build passed; 13/13 stages; 64 tests; 72 Equal Action configurations.
- Created isolated self-contained `cloudflare-production/`.
- Implemented one Worker + Static Assets, D1 global persistence and one random-ID SQLite Durable Object per room.
- Implemented HMAC code lookup, opaque WebSocket tickets, secure sessions, snapshot/journal, hibernatable sockets, persist-before-broadcast, idempotent alarms, archive retries and Turnstile escalation.
- Fixed source-level lifecycle/security findings found during audits.
- Passed TypeScript, lint, 45 engine contracts, leak/security scans, 72 deterministic Equal Action checks, web build and bundle hygiene.
- npm registry returned HTTP 503; official Wrangler/Vitest/Playwright execution is pending registry availability.
- Remote Cloudflare authentication has not been requested early and no staging URL is claimed.

- 2026-07-23: Corrected journal rows so replayed resulting states carry their real event sequence.
- 2026-07-23: Added actual-byte request-body enforcement, bounded rate-limit cleanup and failed invitation accounting.
- 2026-07-23: Updated Workers tests to current `cloudflare:workers` env/exports guidance.
- 2026-07-23: Re-ran all credential-free checks and preserved Node regression; all passed.
- 2026-07-23: npm registry remained unavailable with HTTP 503; official Workerd tests and generated lockfile recorded honestly as pending.
