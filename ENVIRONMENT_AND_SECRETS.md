# Environment and Secrets

## Non-secret variables

Configured in `wrangler.jsonc` per environment:

- `APP_ENV`
- `APP_VERSION`
- `PUBLIC_ORIGIN`
- `TURNSTILE_MODE`
- `TURNSTILE_SITE_KEY`
- `ROOM_CODE_LOOKUP_KEY_VERSION`
- `ROOM_TTL_HOURS`
- `SESSION_TTL_HOURS`
- `WS_TICKET_TTL_SECONDS`

## Required secrets

Set separately in staging and production:

```bash
npx wrangler secret put PIN_PEPPER --env staging
npx wrangler secret put SESSION_HASH_SECRET --env staging
npx wrangler secret put ROOM_CODE_LOOKUP_SECRET --env staging
npx wrangler secret put INTERNAL_DO_ROUTING_SECRET --env staging
npx wrangler secret put TURNSTILE_SECRET_KEY --env staging
```

Repeat with `--env production` only after staging acceptance.

Rules:

- Never place values in source, config, docs or shell history.
- Use cryptographically random values of at least 32 bytes.
- Rotate by creating a versioned secret and a migration period when persistent digests depend on it.
- Do not copy staging secrets into production.
