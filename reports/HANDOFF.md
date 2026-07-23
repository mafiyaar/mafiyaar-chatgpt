# Handoff

1. Read `README.md` and `ENVIRONMENT_AND_SECRETS.md`.
2. Restore npm registry access, run `npm install`, and commit the generated lockfile.
3. Run `npm run test:credential-free`, then `npm test`, `npm run build`, `npm run d1:migrate:local`, and `npm run cf:check`.
4. Authenticate with `npx wrangler login`.
5. Follow `RESOURCE_BOOTSTRAP.md` and `STAGING_RUNBOOK.md`.
6. Do not deploy until the Workers-runtime scrypt test and all Durable Object lifecycle tests pass.
7. After deployment, run the hosted leak scan, multi-client suite and six-phone playtest.
