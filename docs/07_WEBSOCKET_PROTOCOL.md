# 07 — WebSocket Protocol

The browser requests a ticket through authenticated HTTP, then connects to `/ws/connect/:ticket`. The Worker rejects cross-origin and invalid-version requests before consuming the ticket, resolves the private Durable Object ID and forwards the upgrade internally. The Durable Object sends snapshots, recipient-filtered room updates, command acknowledgements and safe categorized errors.
