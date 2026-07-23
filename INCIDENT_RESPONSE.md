# Incident Response

## Priority order

1. Protect hidden information.
2. Stop contradictory state transitions.
3. Preserve the room snapshot and journal.
4. Communicate a public technical pause or honest abandonment.
5. Restore service or roll back.

## Never log

PINs, peppers, session tokens, invitation tokens, connection tickets, match seed, role map, private actions, unrevealed votes or full player views.

## Common incidents

- **Alarm failed:** inspect safe alarm category, verify expected deadline, invoke idempotent recovery.
- **Archive failed:** leave room summary available; retry idempotently.
- **Version mismatch:** reject new client before room join; do not reinterpret old state.
- **Suspected leak:** stop deployment, preserve safe evidence, rotate affected secrets, run deployed leak corpus.
