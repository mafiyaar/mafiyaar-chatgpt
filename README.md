# MafiYaar — Cloudflare Production

A self-contained Cloudflare implementation of MafiYaar following the frozen Architecture Lock.

**Architecture Lock SHA-256:** `1d1b0ba736d8c6064c716694c3824db6731452ad10b2fc7e2e41d809138edf25`

## Runtime

- One Cloudflare Worker serves the PWA, HTTP APIs and WebSocket router.
- One randomly identified SQLite-backed Durable Object owns each active room.
- D1 owns accounts, profiles, sessions, the HMAC room directory and completed history.
- Hibernatable WebSockets carry live room traffic.
- One idempotent Durable Object alarm owns the current phase deadline.
- Turnstile is escalation-only and disabled in local development.
- Supabase is not used in the critical path.

## Start locally

```bash
npm install
cp .dev.vars.example .dev.vars
npm run d1:migrate:local
npm run dev
```

Open `http://localhost:8787`. Use separate browser profiles or private windows to represent different players.

## Verify

```bash
npm run typecheck
npm run lint
npm run test
npm run build
npm run verify:production-bundle
```

## Deploy staging

Read `RESOURCE_BOOTSTRAP.md`, `ENVIRONMENT_AND_SECRETS.md`, then `STAGING_RUNBOOK.md`. Remote deployment requires an authenticated Cloudflare account and real resource identifiers; no URL is claimed until those commands execute successfully.

## Status terms

- **Complete locally:** source and credential-free deterministic checks pass.
- **External activation pending:** Cloudflare login/resources are required.
- **Real-room validation pending:** six physical phones and people are required.
