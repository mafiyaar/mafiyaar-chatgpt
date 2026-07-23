import path from 'node:path';
import { cloudflareTest, readD1Migrations } from '@cloudflare/vitest-pool-workers';
import { defineConfig } from 'vitest/config';
export default defineConfig({
  plugins:[cloudflareTest(async()=>({wrangler:{configPath:'./wrangler.jsonc'},miniflare:{bindings:{TEST_MIGRATIONS:await readD1Migrations(path.join(process.cwd(),'migrations/d1')),APP_ENV:'test',APP_VERSION:'1.0.0-test',PUBLIC_ORIGIN:'http://example.test',TURNSTILE_MODE:'disabled',TURNSTILE_SITE_KEY:'1x00000000000000000000AA',ROOM_TTL_HOURS:'12',SESSION_TTL_HOURS:'720',WS_TICKET_TTL_SECONDS:'45',PIN_PEPPER:'test-pin-pepper-32-bytes-minimum-value',SESSION_HASH_SECRET:'test-session-secret-32-bytes-minimum',ROOM_CODE_LOOKUP_SECRET:'test-room-code-secret-32-bytes-minimum',INVITATION_HASH_SECRET:'test-invite-secret-32-bytes-minimum',INTERNAL_ROUTING_SECRET:'test-internal-secret-32-bytes-minimum',TURNSTILE_SECRET_KEY:'1x0000000000000000000000000000000AA'}}}))],
  test:{include:['tests/**/*.test.ts'],setupFiles:['./tests/apply-migrations.ts'],sequence:{concurrent:false},fileParallelism:false}
});
