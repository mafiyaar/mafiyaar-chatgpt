# 03 — Durable Object Room

`MafiYaarRoom` initializes private SQLite tables, reconstructs the latest envelope, repairs its expected alarm, restores hibernatable socket attachments and emits one filtered view per recipient. Commands are schema-validated, phase-scoped and command-ID-deduplicated. No public route contains the object ID.
