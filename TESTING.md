# Testing

## Local deterministic checks

```bash
npm run typecheck
npm run lint
npm run test:contract
npm run test:leak
node scripts/security-check.mjs
node scripts/equal-action-test.mjs
npm run build:web
npm run verify:production-bundle
```

## Cloudflare runtime

```bash
npm run d1:migrate:local
npm run test:cloudflare
npm run test:durable
npm run test:realtime
npm run test:e2e
npm run test:visual
npm run build:worker
```

The Cloudflare tests must execute through the official Workers/Vitest pool; Node-only mocks cannot satisfy the Durable Object, D1, alarm or hibernation gates.

## Hosted

```bash
MAFIYAAR_STAGING_URL=https://<real-url> npm run test:e2e:staging
```

Real-room behavioural validation remains separate from technical test completion.
