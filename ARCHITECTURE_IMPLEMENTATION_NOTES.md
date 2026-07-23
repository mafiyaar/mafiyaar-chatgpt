# Architecture Implementation Notes

The implementation follows the immutable Architecture Lock with SHA-256 `1d1b0ba736d8c6064c716694c3824db6731452ad10b2fc7e2e41d809138edf25`.

Key interpretations:

- Public room codes are human references, not object identities or authorization secrets.
- A random Durable Object ID is generated once and retained only in D1/internal bindings.
- WebSocket tickets are short-lived, opaque and consumed by the Worker before internal routing.
- Active secret truth never leaves Durable Object SQLite.
- D1 receives only global identity and authorization-controlled completed truth.
- Persist-before-broadcast is implemented as a Durable Object storage transaction followed by alarm reconciliation and recipient-filtered broadcasts.
- Turnstile is escalation-only; Worker/room throttles are mandatory.
- The Node runtime remains a regression target and is not imported by this workspace.
