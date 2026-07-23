# 15 — Implementation Decision Register

- Used random `newUniqueId()`/`idFromString()` routing; public codes never name objects.
- Used HMAC-SHA256 code lookup with versioned secret ownership.
- Used opaque digest-stored WebSocket tickets.
- Used snapshot plus append-only journal recovery.
- Used D1 idempotency tables for archive/statistics.
- Kept Turnstile escalation-only.
- Kept Supabase absent from runtime.
- Retained Node implementation as independent regression target.
