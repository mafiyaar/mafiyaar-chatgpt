# 00 — Baseline Verification

The preserved Node reference was extracted without Git metadata, so a SHA-256 manifest was used instead of a tag.

Executed source of truth:

- Production build: passed
- Test stages: 13/13
- Executable tests: 64
- Deterministic Equal Action configurations: 72
- Direct Node room server remained independently launchable at verification time

Port-specific differences are intentional and locked: six-digit PIN only, five-character spoken room codes, HMAC directory lookup, random Durable Object IDs and opaque WebSocket tickets.
