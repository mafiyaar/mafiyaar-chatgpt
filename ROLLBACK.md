# Rollback

## Worker rollback

```bash
npx wrangler versions list --env staging
npx wrangler rollback <VERSION_ID> --env staging
```

Use the equivalent production command only during an approved incident.

## D1

Prefer forward-fix migrations. Before risky remote migrations:

```bash
npx wrangler d1 export mafiyaar-staging-db --remote --env staging --output staging-backup.sql
```

D1 Time Travel is a recovery control, not a substitute for reviewed migrations.

## Durable Objects

A running match remains pinned to its stored versions. Never deploy code that silently reinterprets unsupported snapshots. Use compatibility handlers or the honest abandonment path.
