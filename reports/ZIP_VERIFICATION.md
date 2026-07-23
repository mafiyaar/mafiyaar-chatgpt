# ZIP Verification

```json
{
  "ok": true,
  "zip": "MafiYaar_Cloudflare_Deploy_Ready_Final.zip",
  "files": 146,
  "size": 235480,
  "sha256": "c8bf8ddad77ba15b6b74bfd668f307426641110661dbf8f6f81903edc1334ac6",
  "forbiddenEntryScan": "PASS",
  "cleanExtractionCommands": [
    {
      "command": "npm run test:credential-free",
      "returncode": 0,
      "stdout": "\n> mafiyaar-cloudflare-production@1.0.0 test:credential-free\n> npm run typecheck && npm run lint && npm run test:contract && npm run test:crypto && npm run test:d1-contract && npm run test:leak && node scripts/security-check.mjs && node scripts/equal-action-test.mjs && npm run test:browser-equal-action && npm run build:web && npm run verify:production-bundle\n\n\n> mafiyaar-cloudflare-production@1.0.0 typecheck\n> tsc -p tsconfig.json --noEmit\n\n\n> mafiyaar-cloudflare-production@1.0.0 lint\n> node scripts/lint.mjs\n\nLint/static policy passed (45 files).\n\n> mafiyaar-cloudflare-production@1.0.0 test:contract\n> node scripts/engine-contract-tests.mjs\n\n{\n  \"ok\": true,\n  \"checks\": 45\n}\n\n> mafiyaar-cloudflare-production@1.0.0 test:crypto\n> node scripts/crypto-contract-tests.mjs\n\n{\n  \"ok\": true,\n  \"checks\": 8,\n  \"localNodeScryptMs\": 40.23,\n  \"note\": \"This confirms algorithm behavior in Node 22 only. The Workers-runtime gate remains separate.\"\n}\n\n> mafiyaar-cloudflare-production@1.0.0 test:d1-contract\n> python3 scripts/d1-contract-test.py\n\n{\n  \"ok\": true,\n  \"checks\": 13,\n  \"tables\": 16,\n  \"columns\": 122,\n  \"labels\": [\n    \"required tables\",\n    \"no role_map column\",\n    \"no match_seed column\",\n    \"no night_action column\",\n    \"no unrevealed_vote column\",\n    \"no grid_order column\",\n    \"no private_view column\",\n    \"username case-insensitive uniqueness\",\n    \"DO ID unique\",\n    \"archive idempotency key\",\n    \"profile cascade\",\n    \"session cascade\",\n    \"session token index\"\n  ]\n}\n\n> mafiyaar-cloudflare-production@1.0.0 test:leak\n> node scripts/leak-scan.mjs\n\n{\n  \"ok\": true,\n  \"errors\": []\n}\n{\n  \"ok\": true,\n  \"filesScanned\": 58,\n  \"errors\": []\n}\n{\n  \"ok\": true,\n  \"mode\": \"deterministic-layout-contract\",\n  \"checks\": 72,\n  \"deviceSizes\": 6,\n  \"errors\": [],\n  \"note\": \"Browser-rendered test page also exists at /testing/equal-action.html. This contract rejects zero geometry and overflow.\"\n}\n\n> mafiyaar-cloudflare-production@1.0.0 test:browser-equal-action\n> python3 scripts/browser-equal-action.py\n\n{\n  \"ok\": true,\n  \"checks\": 144,\n  \"groups\": 48,\n  \"errors\": [],\n  \"summary\": \"Mafia and Civilian share identical non-zero geometry; spectator uses the same component and card dimensions with public dead-player card-count allowance.\",\n  \"browser\": \"system Chromium through Playwright set_content\"\n}\n\n> mafiyaar-cloudflare-production@1.0.0 build:web\n> node scripts/build-web.mjs\n\nBuilt web assets: 23 entries\n\n> mafiyaar-cloudflare-production@1.0.0 verify:production-bundle\n> node scripts/bundle-hygiene.mjs\n\nProduction bundle hygiene passed (18 files).\n",
      "stderr": ""
    }
  ],
  "packageLockPresent": false,
  "officialDependencyInstall": "NOT RUN \u2014 npm registry HTTP 503 in source environment",
  "errors": []
}
```
