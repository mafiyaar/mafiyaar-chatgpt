# Production Runbook

Production uses its own Worker environment, D1 database, Durable Object namespace/migration, secrets and Turnstile widget.

Required sequence:

1. Complete staging technical acceptance.
2. Resolve every Critical and High audit finding.
3. Create production D1 and configure the real origin.
4. Set independent production secrets.
5. Apply production D1 migrations.
6. Deploy the Worker.
7. Run health/version and smoke tests.
8. Attach `play.mafiyaar.com` only when DNS ownership exists.
9. Monitor errors, alarm results, archive failures and request volume.

Never seed or load-test production.
