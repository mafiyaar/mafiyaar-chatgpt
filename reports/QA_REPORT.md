# QA Report

## Passed

- TypeScript typecheck
- Static lint and security policies
- 45 engine contracts
- 8 crypto contracts
- 13 D1 schema/data contracts
- Leak scan and production-bundle secret scan
- 72 deterministic Equal Action configurations
- 144 Chromium-rendered Equal Action comparisons
- PWA asset build and bundle hygiene
- Preserved Node reference: 13/13 stages, 64 tests, 72 Equal Action contracts

## Authored but not executable in this environment

The official Workers Vitest, Wrangler, D1 local, Durable Object lifecycle and Workerd scrypt suites are present. Installation was blocked by repeated HTTP 503 responses from the configured package registry. These remain mandatory before staging deployment.
