# Staging Runbook

## Preflight

```bash
npm ci
npm run test
npm run build
npm run cf:whoami
node scripts/require-env.mjs staging
npx wrangler secret list --env staging
```

## Deploy

```bash
npm run d1:migrate:staging
npm run deploy:staging
export MAFIYAAR_STAGING_URL=https://<real-worker>.workers.dev
npm run health:staging
npm run test:e2e:staging
```

## Acceptance

- Health and version endpoints return current versions.
- Account registration/login succeeds.
- Six hosted clients complete a match.
- WebSocket leak scan finds no DO ID, seed, role map, private action or unrevealed vote.
- Background/reconnect restores the same private grid order.
- Alarm advances phases without client activity.
- Completed history persists in D1.

Record the actual URL and commands in `reports/DEPLOYMENT_REPORT.md`. Do not write secrets there.
