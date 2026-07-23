# 09 — Versioning and Deployments

Each match pins rules, protocol, engine, state-schema, journal, copy and minimum-client versions. New defaults do not mutate running rooms. Unsupported formats are rejected rather than silently reinterpreted. Staging and production have separate names, D1 IDs, secrets, Turnstile keys and origins.
