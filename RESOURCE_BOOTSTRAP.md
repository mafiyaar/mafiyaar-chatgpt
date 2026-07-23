# Cloudflare Resource Bootstrap

Authentication is intentionally the last external boundary.

```bash
npx wrangler whoami
npm run bootstrap:staging
```

The bootstrap script creates `mafiyaar-staging-db` and writes the returned D1 ID into the staging environment. Review the diff before committing.

Durable Object namespaces are created through the versioned migration in `wrangler.jsonc` during deployment. Static Assets are bundled with the same Worker.

After bootstrap:

1. Replace staging `PUBLIC_ORIGIN` with the real workers.dev hostname.
2. Add the Turnstile staging site key.
3. Set all five secrets.
4. Apply D1 migrations.
5. Deploy.
6. Run health, hosted account, WebSocket and leak tests.
