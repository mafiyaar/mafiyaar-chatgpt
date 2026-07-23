# 01 — Implemented Architecture

One Worker owns HTTP routing and Static Assets. D1 owns global persistent records. One SQLite-backed `MafiYaarRoom` Durable Object owns each active room. Hibernatable WebSockets are accepted only after the Worker consumes an authorized connection ticket. The room stores a bounded snapshot and append-only journal and uses one alarm for its current deadline.
