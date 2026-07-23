# Deployment Overview

MafiYaar deploys as one Worker with Static Assets, D1 and a Durable Object binding. There is no separate Pages project.

## Staging

```bash
npm run cf:whoami
npm run bootstrap:staging
# Fill staging PUBLIC_ORIGIN and TURNSTILE_SITE_KEY in wrangler.jsonc.
# Set the secrets listed in ENVIRONMENT_AND_SECRETS.md.
npm run d1:migrate:staging
npm run deploy:staging
npm run health:staging
```

## Production

Production must use separate D1 resources, secrets and environment configuration.

```bash
npm run bootstrap:production
npm run d1:migrate:production
npm run deploy:production
npm run health:production
```

Production deployment is prohibited until staging tests, leak scans and the staging acceptance checklist pass.
