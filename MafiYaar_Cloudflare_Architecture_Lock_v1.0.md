# MafiYaar — Cloudflare Architecture Lock v1.0

**Status:** LOCKED FOR IMPLEMENTATION  
**Date:** 23 July 2026  
**Product:** MafiYaar  
**Primary deployment target:** Cloudflare  
**Supersedes:** Both prior drafts of `MafiYaar_Cloudflare_Architecture_Lock_v1.0.md` and the earlier “deployment-ready, host later” posture  
**Change control:** Any change to the locked decisions in §2 requires a written v1.1 architecture revision. It may not be changed informally during implementation.

## 0. Binding decision statement

MafiYaar will be delivered as one full-stack Cloudflare Worker deployment serving the PWA, static assets, HTTP APIs, invitation routes and WebSocket entry point.

Each active game room will be owned by one randomly identified, SQLite-backed Cloudflare Durable Object. That Durable Object is the sole authority for the room’s live state, private information, phase deadlines, actions, votes, reconnection truth, resolution and victory checks.

Cloudflare D1 will own global and long-lived data: accounts, profiles, sessions, room-directory records, completed matches, history, statistics and audit records.

Cloudflare Turnstile will be used only as an escalation mechanism for suspicious registration, recovery, login and room-code probing. It will never interrupt an active match action.

Supabase is not part of the critical live-game path. It remains an optional future reporting or archive adapter, disabled by default.

The completed Node.js implementation remains in the repository as a regression target, local fallback and validated reference implementation. It is no longer the primary product-delivery route.

The migration is not complete when it is merely deployment-ready. It is complete only when a public staging URL works while the development machine is switched off.

### Locked architecture in one sentence

A single Cloudflare Worker serves MafiYaar’s PWA and APIs; one randomly identified, SQLite-backed Durable Object owns each active room through Hibernatable WebSockets and idempotent alarms; D1 owns global persistent records; Turnstile protects suspicious traffic; Supabase remains optional and disabled by default.

## 1. Final system topology

```text
Players’ phones
        │
        ▼
https://mafiyaar-staging.<account>.workers.dev
(later: https://play.mafiyaar.com)
        │
        ▼
Cloudflare Worker + Static Assets
├── Serves the MafiYaar PWA
├── Authentication and session APIs
├── Profile, history and statistics APIs
├── Create-room and join-room routes
├── Invitation links and QR landing routes
├── Health, version and integration endpoints
└── Privately resolves a connection ticket to a Durable Object
        │
        ▼
One MafiYaarRoom Durable Object per active room
├── Hibernatable WebSocket connections
├── Room membership and connection truth
├── Secret role map and match seed
├── Current phase and absolute deadline
├── Server-generated per-player target order
├── Night actions and predictions
├── Votes and runoff votes
├── Spectator actions
├── Technical pause and abandonment
├── Reconnection snapshots
├── Match resolution and victory checks
├── Phase snapshot
├── Append-only event journal
└── Idempotent archival of completed truth
        │
        ▼
Cloudflare D1
├── Accounts
├── Profiles and preferences
├── Sessions and recovery records
├── Public room-code directory
├── Short-lived connection-ticket records where needed
├── Completed matches
├── Match players and outcomes
├── Public match events
├── Revealed voting history
├── Resolved prediction history
├── Player statistics
├── Audit records
└── Schema versions
```

No client URL, API response, invitation link or WebSocket route may expose a Durable Object ID.

## 2. Locked decisions

| ID | Decision area | Locked choice |
|---|---|---|
| L-1 | Primary runtime | Cloudflare Workers. The Free plan is suitable for staging and private alpha; a paid-plan upgrade is an operational change, not an architecture change. |
| L-2 | Deployment shape | One full-stack Worker deployment containing Static Assets, HTTP APIs and the WebSocket router. No separate Pages project and no split frontend/backend deployment. |
| L-3 | Room authority | Exactly one SQLite-backed Durable Object per active room. No second live authority and no shared active-room state elsewhere. |
| L-4 | Durable Object identity | Create each room with `newUniqueId()`, store the resulting ID string privately in D1 and reconstruct it with `idFromString()`. Never use the public room code as the Durable Object identity. |
| L-5 | Live-room truth | Secret and unresolved active-room truth remains exclusively inside the room Durable Object and its private SQLite storage. |
| L-6 | Realtime transport | Cloudflare’s Hibernatable WebSocket API. Legacy in-memory-only WebSocket handling is rejected. |
| L-7 | Deadlines | One Durable Object alarm represents the current authoritative phase deadline. No client clock, polling loop, or in-memory `setTimeout()` is authoritative. |
| L-8 | Recovery | Latest phase snapshot plus append-only journal. Recovery loads the snapshot and replays only later events. The journal remains the audit and deterministic-recovery record. |
| L-9 | Global persistence | D1, with separate staging and production databases. D1 stores global records and completed-match archives, never unresolved live secrets. |
| L-10 | Authentication | Worker-owned username, display name and six-digit PIN. Not Supabase Auth and not an email-first identity model. |
| L-11 | PIN hashing | Scrypt is the preferred hash with a unique salt and Worker-secret pepper, subject to an executed Workers-runtime compatibility and cost test. A provider-level migration path must exist. |
| L-12 | Session model | Rotating opaque sessions. Session secrets are never stored in plaintext. Web clients use secure, HttpOnly cookies where compatible; WebSocket upgrades use short-lived opaque connection tickets. |
| L-13 | Public room discovery | A short spoken code resolves through an HMAC lookup to a private room directory record. The code is not a security credential and is never a Durable Object identity. |
| L-14 | Invitation links | Short code plus a separate high-entropy invitation token. Invitation tokens are room-bound, expiring, revocable and never replace normal authorization. |
| L-15 | Abuse protection | Application-level throttling is mandatory. Turnstile is an escalation layer for suspicious registration, recovery, login and probing. It never appears inside the live match loop. |
| L-16 | Client authority | None. The client remains a renderer and input device. It never owns role truth, deadlines, vote resolution or victory logic. |
| L-17 | D1 access | Direct browser access to D1 is prohibited. The Worker is the only global-data gateway. |
| L-18 | Supabase | Disabled by default. Optional future asynchronous reporting/archive adapter only. Never required for active rooms. |
| L-19 | Node implementation | Preserved independently in the repository as the local reference runtime, regression target and emergency fallback. Both runtimes follow the same engine and wire contracts. |
| L-20 | Scope freeze | The Cloudflare port may not introduce a major gameplay or visual redesign. Gameplay tuning remains configuration unless a proven defect requires change. |
| L-21 | Staging and production | Fully separate Worker environments, D1 databases, Durable Object namespaces, secrets, Turnstile keys and deployment workflows. |
| L-22 | Mid-match versioning | Every active match is pinned to explicit rules, protocol, state-schema, journal and copy versions. New defaults affect new rooms only. |
| L-23 | Fairness laws | Per-connection filtered views only; no seed, complete role map, selection maps, unrevealed votes or completion counts in client messages; no early secret-phase completion; server-generated stable target order; one shared NightAction component; achromatic night surfaces within the tested luminance envelope. |
| L-24 | Temporary hosting | Cloudflare Tunnel may be used only for emergency demonstration. It is not staging, production or an implementation phase. |
| L-25 | Completion standard | A public staging deployment, deployed leak scan and hosted multi-phone test are mandatory. “Deployment-ready” is not completion. |

### Deliberately not locked

The following remain owner or evidence-based decisions:

- Acquisition of `mafiyaar.com` and the final production subdomain
- Exact date of a Workers Paid upgrade
- User-uploaded avatars and R2 usage
- Gameplay defaults already classified as provisional or experimental
- Optional email-recovery provider
- Optional future Supabase reporting activation

## 3. Product north star

**Everyone plays. The room remains the game. The application never becomes evidence.**

The application replaces:

- Paper role slips
- A non-playing Host
- Manual role distribution
- Manual night administration
- Manual timers
- Manual voting and counting
- Manual elimination tracking
- Manual victory checks
- Selection of eliminated players
- Rule-memory disputes

The application does not replace:

- Talking
- Lying
- Persuasion
- Accusation
- Defence
- Suspicion
- Reading expressions
- Reading speech patterns
- Group humour
- Physical social tension

Phones must remain secondary during face-to-face discussion.

## 4. Why this architecture is final

### 4.1 One room naturally equals one Durable Object

MafiYaar already models a room as one server-authoritative object that receives commands and emits filtered player views. A Durable Object is the native runtime for that design: one coordination authority, serialized execution and colocated strongly consistent storage.

### 4.2 Hibernation matches MafiYaar’s cost profile

The dominant runtime pattern is long periods of physical discussion with almost no server work. Hibernatable WebSockets keep players connected while allowing the Durable Object to leave memory. In-memory state must therefore be treated as disposable and reconstructed from storage after wake.

### 4.3 Alarms match the phase model

A MafiYaar room has one authoritative current deadline. Durable Object alarms provide one future wake-up per object, at-least-once delivery and automatic retry. The room must therefore make every alarm transition idempotent.

### 4.4 D1 is sufficient for the global path

Clients do not query the database directly. The Worker owns authorization and data access. D1 is therefore a simpler initial fit than adding a second provider solely for database features the product does not use.

### 4.5 The existing work is retained

The following remain valid and should be reused:

- TypeScript game engine
- Shared contracts
- Roman Urdu and English copy system
- Preact PWA
- Equal Action components
- Visibility filtering
- Authentication rules
- Reconnection protocol
- Security regression tests
- Match simulations
- PWA assets
- Database model concepts

The migration replaces platform adapters and deployment topology, not the product.

## 5. Durable Object identity, room codes and invitation security

### 5.1 Durable Object creation

Rooms are created with a random Cloudflare-generated ID:

```ts
const id = env.MAFIYAAR_ROOMS.newUniqueId();
const durableObjectId = id.toString();
```

The Worker stores `durableObjectId` privately in D1. Later requests reconstruct the ID with:

```ts
const id = env.MAFIYAAR_ROOMS.idFromString(durableObjectId);
const stub = env.MAFIYAAR_ROOMS.get(id);
```

The Durable Object ID must never appear in:

- A public URL
- A QR code
- A browser-visible API payload
- A local-storage record
- A WebSocket path
- Analytics or public logs

### 5.2 Public room code

Example:

```text
4K7P2
```

The code is optimized for speaking aloud. It is not an authentication secret.

D1 stores only an HMAC lookup value:

```text
HMAC-SHA256(normalizedRoomCode, ROOM_CODE_LOOKUP_SECRET)
```

A normal unsalted hash is prohibited because a short-code space can be enumerated offline.

Recommended room-directory fields:

```text
room_codes
├── code_lookup_hmac
├── lookup_key_version
├── durable_object_id
├── invitation_token_hash
├── created_by
├── created_at
├── expires_at
├── status
└── failed_join_count
```

The HMAC key is a Worker secret and must support versioned rotation.

### 5.3 Invitation token

Invitation links use a separate high-entropy token:

```text
https://play.mafiyaar.com/join/4K7P2?t=<opaque-high-entropy-token>
```

The token must:

- Contain at least 128 bits of entropy or use an equivalent signed-and-encrypted construction
- Be bound to one room
- Expire
- Be revocable
- Be stored only as a cryptographic digest when server-side lookup is used
- Never grant access without session and room authorization

### 5.4 WebSocket connection ticket

The browser does not connect using the Durable Object ID.

Recommended flow:

```text
Resolve room or invitation
→ authenticate session
→ authorize room membership
→ issue a short-lived opaque connection ticket
→ client opens /ws/connect/:ticket
→ Worker privately resolves ticket to durable_object_id
→ Worker forwards the upgrade to the Durable Object
```

The connection ticket must be single-use or narrowly reusable, short-lived and bound to the authenticated session and room membership.

## 6. Exact data ownership

| Data | Locked owner | Notes |
|---|---|---|
| Active room membership and ready state | Durable Object | D1 may hold a directory status, not live truth. |
| Secret role map and match seed | Durable Object only | Never serialized to a client or written to D1. |
| Mafia teammate knowledge | Durable Object filtered view | Visible only to authorized Mafia players. |
| Current phase and deadline | Durable Object | Alarm is the authoritative wake-up. |
| Per-player target order | Durable Object | Persisted by player and phase sequence; stable across reconnect. |
| Night actions | Durable Object | Phase-scoped. |
| Civilian and spectator predictions | Durable Object | Never influence real kill resolution. |
| Unrevealed votes and runoff votes | Durable Object | Revealed ledgers become archivally eligible after resolution. |
| Tie-resolution inputs | Durable Object | Never exposed before rule-authorized reveal. |
| Reconnection and duplicate-device truth | Durable Object | Rebuilt from storage plus socket attachments. |
| Active room snapshot and journal | Durable Object SQLite | Recovery source. |
| Public room-code directory | D1 | HMAC lookup only; no plaintext code required. |
| Accounts, profiles and preferences | D1 | Worker-authorized access only. |
| Hashed PINs, sessions and recovery | D1 | No raw PIN or session secret. |
| Completed matches and outcomes | D1 after `MATCH_END` | Controlled archival, not automatically public. |
| Revealed public events and vote history | D1 after rule-authorized reveal | Authorization still applies. |
| Resolved prediction history and statistics | D1 after `MATCH_END` | Player- or room-scoped visibility may apply. |
| Audit records | D1 | Never contain secrets, roles, actions or raw credentials. |
| Avatars | Bundled assets initially | R2 only when uploads are introduced. |
| Abuse challenge state | Worker/Turnstile | Never used inside live match actions. |

D1 must never become the active real-time game engine.

## 7. Active-room persistence: snapshot plus journal

Important state must survive:

- Hibernation
- Object eviction
- Worker deployment
- Runtime restart
- Temporary loss of every connection
- Browser backgrounding
- Network changes
- Alarm retry

### 7.1 Snapshot

The room keeps a bounded current snapshot containing at least:

```text
room_state
├── room_id
├── match_id
├── room_status
├── current_phase
├── phase_sequence
├── phase_started_at
├── phase_ends_at
├── phase_resolved_at
├── settings_json
├── authoritative_state_json
├── rules_version
├── protocol_version
├── engine_version
├── state_schema_version
├── journal_version
├── copy_version
├── client_minimum_version
├── last_event_sequence
├── state_version
├── archive_status
├── archive_attempts
└── updated_at
```

Create or refresh a snapshot after:

- Room or match creation
- Role assignment
- Every phase transition
- Every elimination
- Victory
- Rematch creation

### 7.2 Append-only journal

```text
room_events
├── sequence
├── command_id
├── actor_player_id
├── event_type
├── visibility
├── payload_json
├── resulting_state_version
├── rules_version
├── journal_version
└── created_at
```

Requirements:

- `sequence` is monotonic.
- `command_id` is unique when present.
- Every action carries a `phase_sequence` in its payload or envelope.
- Secret payloads remain inside the room’s private database.
- The journal is never broadcast wholesale.

### 7.3 Recovery algorithm

```text
Load latest snapshot
→ verify supported versions
→ replay events after last_event_sequence
→ verify resulting state_version
→ enumerate live sockets and deserialize attachments
→ verify or restore the current alarm
→ generate fresh recipient-filtered views
```

Snapshotting bounds reconstruction cost. It does not replace the journal.

No performance claim such as “sub-millisecond replay” is locked until measured in the Workers runtime.

## 8. Persist-before-broadcast transaction law

Every state-changing command follows this order:

1. Authenticate the session or connection ticket.
2. Restore and validate the socket attachment.
3. Authorize room membership.
4. Validate client, protocol and minimum-version compatibility.
5. Validate the command schema.
6. Check command ID, sequence number and replay status.
7. Verify current phase, `phase_sequence` and deadline.
8. Resolve the command against authoritative state.
9. Transactionally persist the journal event and resulting snapshot/state.
10. Store the expected alarm deadline in authoritative state.
11. Set, replace, verify or delete the Durable Object alarm.
12. Generate one filtered view per recipient.
13. Broadcast recipient-specific results.
14. Return the acknowledgement to the actor.

The room must never broadcast success before the state that produced it is durable.

If persistence fails, the command fails and no client is told it succeeded.

If state persistence succeeds but alarm scheduling fails, the persisted state must record the expected alarm and recovery path; no contradictory success broadcast may be issued until the room has restored a valid scheduling state.

## 9. Authoritative deadlines and idempotent alarms

Every timed phase stores an absolute server timestamp:

```ts
phaseEndsAt: number;
phaseSequence: number;
```

Clients render countdowns locally against the server deadline. They never decide that a phase has ended.

### Locked deadline behaviour

- Night never ends early because Mafia submitted.
- Night never ends early because everyone submitted.
- Voting never ends early because everyone voted.
- A disconnected player cannot freeze the room indefinitely.
- A manipulated phone clock cannot affect resolution.
- A late packet cannot reopen a resolved phase.
- A hibernated room wakes to resolve the phase.

### Alarm guard

Before resolving, the alarm handler verifies:

```text
stored_phase_sequence === expected_phase_sequence
stored_phase_status === "active"
stored_phase_ends_at <= server_now
stored_phase_resolved_at IS NULL
```

After resolving, it persists:

- `phase_resolved_at`
- Incremented `state_version`
- Next phase
- Next deadline
- Expected next alarm, when required

Durable Object alarms have at-least-once execution. Running the same alarm logic again must not duplicate:

- A kill
- An elimination
- A vote result
- A public event
- A statistics update
- An archive
- A broadcasted transition

The handler must catch recoverable downstream archival failures and schedule its own safe retry when the platform’s finite automatic retry behaviour is insufficient.

## 10. Hibernatable WebSockets and attachments

The room uses Cloudflare’s Hibernation WebSocket API.

A Durable Object may be evicted from memory while WebSockets remain connected. On wake, its constructor runs again and in-memory maps are gone.

### Socket attachment

Keep the serialized attachment small and connection-scoped:

```ts
interface SocketAttachment {
  sessionId: string;
  playerId: string;
  roomMemberId: string;
  clientVersion: string;
  protocolVersion: string;
  lastAcknowledgedSequence: number;
  attachmentVersion: string;
}
```

Attachments must not contain:

- Room state
- Full player view
- Role map
- Seed
- Vote map
- Action history
- Long idempotency history

Cloudflare currently limits a serialized attachment to 16,384 bytes; MafiYaar’s attachment should remain far below that and rely on room storage for durable data.

### Hibernation rules

- Reconstruct authoritative state from room storage.
- Use attachments only to reconnect sockets to identities.
- Do not rely on in-memory connection maps after constructor re-entry.
- Do not use `setInterval()` for countdowns or heartbeats.
- Do not use continuous server countdown loops.
- Avoid outgoing WebSockets from the room.
- Let clients render time from absolute server deadlines.
- Validate the WebSocket upgrade in the Worker before invoking the Durable Object.

## 11. Reconnection, duplicate devices and command idempotency

When a player reconnects or returns from the background, the client discards stale assumptions and requests a fresh authoritative snapshot.

The snapshot contains only information the player is currently permitted to know:

```ts
interface ReconnectionSnapshot {
  publicRoomCode: string;
  matchId: string | null;
  playerId: string;
  roomStatus: string;
  phase: string;
  phaseSequence: number;
  phaseEndsAt: number | null;
  aliveState: string;
  permittedAction: unknown | null;
  acceptedActionState: unknown | null;
  publicEventsSince: PublicEvent[];
  filteredPlayerView: PlayerView;
  serverTime: number;
  stateVersion: number;
  protocolVersion: string;
}
```

It never contains:

- Durable Object ID
- Complete role map
- Match seed
- Other players’ private views
- Other players’ actions or predictions
- Unrevealed votes
- Completion counts
- Identity of a player who has not submitted

### Idempotency

- Every state-changing client command has a unique `command_id`.
- The journal enforces command deduplication.
- Phase-scoped replaceable actions, such as a revised vote, use explicit last-write-wins semantics before the deadline.
- A command from an old `phase_sequence` is always rejected.
- Duplicate connections follow one documented server policy and may not silently create two active identities.
- Stable target order is persisted by player and phase sequence and restored exactly after reconnect.

## 12. Equal Action production contract

Equal Action is a security and fairness property, not only a visual guideline.

Mafia, Civilian and Spectator night states use one shared component implementation. The server injects only authorized meaning and eligibility.

The following remain matched where player-state rules permit:

- Viewport structure
- Instruction-container geometry
- Grid geometry
- Card dimensions
- Timer location
- Confirmation sequence and duration
- Selection feedback
- Waiting state
- Loading state
- Animation duration
- Luminance
- Scrolling behaviour
- Browser-chrome behaviour

Secret phases never expose:

- Completion counts
- “Waiting for Player X”
- Mafia-only delays
- Role-specific colour, glow, haptic or sound
- Role-specific loading
- Role-specific scrolling
- Role-specific button placement

The backend generates target order. No target-order or role-assignment seed reaches a client.

A deployed Equal Action test is invalid when any measured geometry is zero, unavailable, font-incomplete or unrendered.

## 13. Authentication and sessions

### User experience

- Username
- Display name
- Six-digit PIN
- Persistent trusted-device session
- Optional recovery method later

Four-digit PINs are rejected for persistent accounts.

### PIN records

D1 stores only:

```text
pin_hash
pin_salt
hash_version
hash_parameters
failed_attempt_count
locked_until
```

The pepper remains a Worker secret and is never stored in D1 or source code.

### Preferred hashing

- Scrypt
- Unique cryptographic salt per account
- Server-side pepper
- Constant-time verification
- Uniform-work failure paths to reduce account enumeration
- Versioned parameters
- Migration-on-next-login when parameters change

### Workers-runtime gate

The local Node implementation is not proof that the algorithm is operationally acceptable in Workers. Phase 2 cannot pass until registration and verification are exercised in the actual Workers runtime under `nodejs_compat`, including CPU and failure-path measurements.

If scrypt is unavailable or operationally unsuitable, the `AuthProvider` interface must permit a migration-compatible alternative approved in a written implementation note. PBKDF2-HMAC-SHA256 through Web Crypto is the defined fallback candidate; any iteration count must be set from then-current security guidance and verified against Workers limits rather than hardcoded from this architecture document.

### Session requirements

- Opaque rotating session token
- Only a token digest stored in D1
- HttpOnly and Secure cookie where applicable
- SameSite=Lax or stricter where compatible
- CSRF protection for state-changing HTTP routes
- Session rotation after login, recovery and sensitive changes
- Session invalidation on logout and security changes
- Duplicate-device policy enforced by the server
- Short-lived opaque ticket for WebSocket connection

### Abuse controls

Application-level protection must work without optional managed Cloudflare rules:

- Worker-level account, IP and endpoint throttling
- Durable Object per-room and per-account command throttling
- Account lockout and progressive delay
- Turnstile escalation for suspicious registration, recovery, login and code probing
- Optional managed Cloudflare rate-limiting rules as an extra layer

Turnstile is never the sole authorization check.

## 14. D1 global schema responsibilities

Minimum migrations cover:

```text
accounts
profiles
player_preferences
sessions
recovery_tokens
room_codes
room_invitations
connection_tickets
completed_matches
completed_match_players
completed_public_events
completed_votes
completed_predictions
player_statistics
audit_events
schema_versions
```

Required protections:

- Foreign keys
- Unique constraints
- Expiry indexes
- Account-deletion strategy
- Session lookup indexes
- Match-history indexes
- Idempotent archival key
- No raw PIN
- No raw session token
- No live role map
- No unresolved action
- No unrevealed vote
- No direct client queries

Completed-match archival remains authorization-controlled. Match completion does not make account-linked information globally public.

## 15. Completed-match archival

At `MATCH_END`, the room creates one versioned immutable archival package:

```ts
interface CompletedMatchArchive {
  archiveVersion: string;
  matchId: string;
  publicRoomCode: string;
  rulesVersion: string;
  engineVersion: string;
  startedAt: number;
  endedAt: number;
  winner: "mafia" | "civilian";
  players: CompletedPlayerRecord[];
  eliminations: CompletedElimination[];
  revealedVotes: CompletedVoteRecord[];
  resolvedPredictions: CompletedPredictionRecord[];
  publicEvents: CompletedPublicEvent[];
  statisticsDelta: PlayerStatisticsDelta[];
}
```

D1 writes are idempotent using `match_id` and `archive_version`.

If archival fails:

```text
archive_status = pending
archive_attempts += 1
last_archive_error_code = safe_categorized_value
next_archive_retry_at = timestamp
```

The completed summary remains available from the Durable Object until D1 confirms archival.

Repeated archival must never duplicate history or statistics.

A Queue is not required for v1. Queues may later handle analytics fan-out, email, exports or higher-volume archival.

## 16. Worker route map

```text
/                               MafiYaar PWA
/join/:code                     Invitation landing
/install                        Install guidance
/how-to-play                    Cached public rules
/privacy                        Privacy information
/api/auth/register              Account creation
/api/auth/login                 Login
/api/auth/logout                Logout
/api/auth/session               Session restore
/api/auth/recovery/*            Recovery flow
/api/profile/*                  Profile and preferences
/api/history/*                  Match history and statistics
/api/rooms/create               Create room
/api/rooms/resolve/:code        Resolve typed public code
/api/rooms/:code/invite         Generate or rotate invitation
/api/rooms/:code/connect-ticket Issue authorized short-lived WS ticket
/ws/connect/:ticket             Authenticated WebSocket upgrade
/health                         Deployment health
/version                        Client/server compatibility
```

The browser never receives the Durable Object ID.

The Worker authenticates the session, validates the ticket and resolves the private room directory record before forwarding the upgrade.

## 17. Platform adapter boundaries

The game engine remains platform-neutral. It must not import Worker, Durable Object, D1 or Wrangler APIs.

Minimum interfaces:

```ts
interface RoomTransport {}
interface RoomPersistence {}
interface GlobalRepository {}
interface SessionRepository {}
interface DeadlineScheduler {}
interface Clock {}
interface ArchiveWriter {}
interface AbuseProtectionProvider {}
interface IdGenerator {}
```

| Interface | Cloudflare implementation | Existing implementation |
|---|---|---|
| RoomTransport | Durable Object Hibernatable WebSockets | Node WebSocket server |
| RoomPersistence | Durable Object SQLite snapshot/journal | Local SQLite/in-memory adapter |
| GlobalRepository | D1 | Local SQLite repository |
| SessionRepository | D1 session repository | Local SQLite session repository |
| DeadlineScheduler | Durable Object alarm | Node timer/test clock |
| Clock | Server clock | Node/test clock |
| ArchiveWriter | Idempotent D1 archive | Local archive writer |
| AbuseProtectionProvider | Worker/DO throttling + Turnstile | Local bypass/test adapter |
| IdGenerator | Cloudflare random/crypto IDs | Node crypto IDs |

The Node target must remain green throughout the port.

## 18. Staging and production separation

### Staging

```text
Worker:              mafiyaar-staging
D1:                  mafiyaar-staging-db
Durable namespace:   staging room namespace
Secrets:             staging values
Turnstile:           staging widget
URL:                  https://mafiyaar-staging.<account>.workers.dev
```

### Production

```text
Worker:              mafiyaar-production
D1:                  mafiyaar-production-db
Durable namespace:   production room namespace
Secrets:             production values
Turnstile:           production widget
URL:                  Cloudflare production URL, then https://play.mafiyaar.com
```

A staging migration, reset, seed, load test or destructive test must never touch production resources.

## 19. Rules, protocol and deployment version policy

Every active room stores and freezes:

```text
rules_version
protocol_version
engine_version
state_schema_version
journal_version
copy_version
client_minimum_version
```

Policy:

- A match keeps the rules version it started with.
- New defaults apply only to new rooms.
- The Worker must support the current and immediately previous active room format during ordinary rolling deployment.
- Breaking state or journal changes require explicit migration or replay-compatibility handlers.
- An incompatible client receives an update-required response before joining.
- The constructor must refuse silent reinterpretation of an unsupported snapshot or journal.
- An incompatible emergency deployment may end an active match through the honest abandonment path rather than corrupting or reinterpreting it.
- Deployment workflows should query live-room status before intentional breaking releases.
- Dev-truth panels and migration utilities remain unreachable from production clients.

## 20. Supabase’s locked future role

Supabase remains outside the critical v1 runtime.

It may later receive controlled asynchronous copies of completed records for:

- Advanced reporting
- A nontechnical data dashboard
- Complex cross-match analytics
- External integrations
- A reporting warehouse
- Richer social or group features

Supabase must never become a dependency for:

- Active role truth
- Current phase
- Deadlines
- Night actions
- Unrevealed votes
- Reconnection truth
- Match resolution

Activation requires a written evidence-backed architecture revision or extension note.

## 21. Execution plan with hard exit gates

### Phase 1 — Architecture freeze

**Work:** Approve this document.  
**Exit gate:** Owner approval recorded. No migration code moves before approval.

### Phase 2 — Cloudflare workspace and platform seams

**Work:**

- Create Worker workspace and Wrangler environments
- Configure Static Assets, Durable Object and D1 bindings
- Finalize platform-neutral interfaces
- Implement environment validation and secrets checklist
- Execute scrypt registration and verification in the Workers runtime

**Exit gate:**

- Node target still green through the seams
- Workers local runtime boots
- Hashing compatibility and cost test executed
- No engine package imports Cloudflare APIs

### Phase 3 — Durable Object room runtime

**Work:**

- Create `MafiYaarRoom`
- Implement random DO identity and private directory routing
- Authenticated Hibernatable WebSocket upgrades
- Attachments, reconnect and duplicate-device policy
- Snapshot and journal
- Persist-before-broadcast
- Alarm deadlines
- Technical pause, abandonment, victory and rematch

**Exit gate:** Workers test-pool coverage passes for:

- Constructor re-entry
- Eviction reconstruction
- Hibernated-socket recovery
- Attachment restoration
- Alarm-driven advancement
- Stale and duplicate alarm rejection
- Alarm retry safety
- Persist-before-broadcast ordering
- Command deduplication
- Cross-room isolation

### Phase 4 — D1 global persistence

**Work:** Apply staging migrations for accounts, profiles, sessions, recovery, room directory, connection tickets, completed matches, public events, revealed votes, predictions, statistics and audit.

**Exit gate:**

- Migrations applied to staging D1
- Archival round-trip green
- Retry and duplicate-archive tests green
- Automated schema scan finds no live secret-bearing columns

### Phase 5 — One full-stack Worker deployment

**Work:** Deploy the PWA, APIs, invitation routes and WebSocket router as one Worker.

**Exit gate:**

- `wrangler dev` full match succeeds
- Public staging deployment succeeds
- Health and version routes pass

### Phase 6 — Deployed Cloudflare validation

**Work:** Run the existing suites and Cloudflare-specific tests against the public staging deployment.

The exit criterion is the deployed traffic evidence, not local confidence.

**Required:**

- Existing engine/security/realtime suites green
- Leak-scan corpus run against real deployed WebSocket traffic
- No seed, role map, private view, unrevealed vote or action leak
- Equal Action E2E against staging
- D1 archival retries
- Auth and room-code throttling
- Dev-truth exclusion
- Background and reconnect simulations

### Phase 7 — Real-device staging acceptance

**Work:** Run the six-phone session through the public staging URL.

**Required:**

- At least one iPhone and one Android
- Wi-Fi and mobile-data clients
- Background and return
- Phone lock and return
- Reconnect during night and voting
- Missed Mafia action
- Missed Civilian prediction
- Missed vote
- Tie and runoff
- Peaceful night
- One- and two-Mafia matches
- Both victory types
- Rematch
- History persistence
- Physical Equal Action observation

**Exit gate:** Playtest protocol completed and findings recorded in the decision register.

### Phase 8 — Production

**Work:**

- Separate production D1 and DO namespace
- Production Worker secrets
- Turnstile production keys
- Versioned D1 and DO migrations
- GitHub deployment workflow
- Post-deploy health check
- Rollback and recovery instructions
- Usage monitoring and alerts
- Custom-domain TLS when the domain exists

**Exit gate:** A verified production Worker URL exists. Attaching the final custom domain may remain the only external owner step.

## 22. Automated validation requirements

### Durable Object lifecycle

- Constructor re-entry
- Hibernation wake-up
- Eviction reconstruction
- Storage-only recovery
- Socket attachment restoration
- Version-compatibility gate

### Deadlines

- Alarm phase advancement
- Stale alarm rejection
- Duplicate alarm execution
- Alarm retry safety
- Missed-action fallback
- Missed-vote fallback
- No early secret-phase completion

### Persistence

- Persist-before-broadcast
- Journal idempotency
- Snapshot-plus-tail replay
- Phase-scoped action isolation
- D1 archival retry
- Duplicate archival rejection
- Statistics idempotency

### Security and visibility

- No Durable Object ID in browser payloads or routes
- No seed
- No complete role map
- No other-player private view
- No unrevealed vote
- No other-player action
- Cross-room isolation
- Unauthorized room rejection
- Invalid session rejection
- Expired invitation rejection
- Expired connection-ticket rejection
- Room-code HMAC lookup
- Room-code throttling
- Login and recovery throttling
- Dev truth absent from production

### Equal Action

Test across:

- Mafia, Civilian and Spectator
- 6 and 12 players
- 320×568
- 360×800
- 375×812
- 390×844
- 412×915
- 430×932
- Roman Urdu and English
- Increased text size
- Font fallback
- Landscape guard

A PASS is invalid when measured geometry is zero, unavailable or captured before fonts and styles finish rendering.

## 23. Technical completion gate

The Cloudflare migration is technically complete only when:

- A public staging URL exists.
- The development machine can be switched off.
- Six browser clients complete full hosted matches.
- Every active room is server-authoritative.
- Hibernation recovery is tested.
- Alarm advancement and retries are idempotent.
- Durable Object reconstruction is tested.
- D1 persists accounts and history across deployments.
- Reconnection works after backgrounding and phone lock.
- Fixed deadlines do not resolve early.
- Stable private grid order survives reconnect.
- Deployed WebSocket traffic passes the visibility leak scan.
- Equal Action browser tests pass against staging.
- Staging deployment, migration, rollback and recovery commands are documented.
- Production resources are defined separately.

## 24. Product-validation gate

Product validation is complete only when:

- Six real people play in the same room.
- Mixed iPhone and Android devices are used.
- At least one full match completes.
- At least one rematch completes.
- Physical screen glow and posture are observed.
- Decision-time differences are recorded.
- Roman Urdu copy is understood without developer coaching.
- No reliable app-generated Mafia tell is observed above chance.
- Connection recovery succeeds in real use.
- Findings are documented.
- Critical product findings are fixed and retested.

A behavioural or comprehension finding does not retroactively invalidate correct technical migration. It becomes evidence for the next product revision.

## 25. Usage, monitoring and cost policy

Free hosting is an alpha benefit, not a permanent architectural promise.

The implementation must record and monitor:

- Worker requests
- Durable Object requests
- WebSocket messages per match
- Alarm invocations
- Durable Object rows read and written
- D1 rows read and written
- Durable Object storage
- D1 storage
- Failed room operations
- Match archival failures
- Match completion rate
- Reconnection volume

Current platform limits and pricing must be rechecked against official documentation immediately before staging and production.

Operational facts verified on 23 July 2026 include:

- Workers Free: 100,000 requests per day
- Durable Objects Free: 100,000 requests per day, including WebSocket messages and alarm invocations
- D1 Free: 10 databases per account, 500 MB maximum per database, 5 GB total account storage and 7 days of Time Travel
- Hibernatable WebSockets avoid duration billing while eligible objects are idle

These values are not permanent architecture commitments. When measured usage justifies it, upgrading to Workers Paid is preferable to waiting for hard-limit failures.

## 26. Explicitly rejected alternatives

- Traditional always-running VPS as the primary architecture
- Local-server-first public experience
- Cloudflare Pages plus an unrelated backend
- Supabase Realtime as active-room authority
- Firebase as active-room authority
- Polling-based multiplayer
- Peer-to-peer authority
- Client-owned timers or resolution
- Public-code-derived Durable Object identity
- Direct browser access to D1
- Cloudflare Tunnel as staging or production
- Multiple mandatory infrastructure providers from day one
- Major gameplay redesign during the Cloudflare port

## 27. Decision register

| Decision | Status | Confidence | Revisit trigger |
|---|---|---|---|
| Cloudflare is the primary runtime | Locked | High | A required live-game behaviour fails in public staging and has no safe platform-compatible solution. |
| One full-stack Worker deployment | Locked | High | A demonstrated deployment limitation requires separation. |
| One Durable Object per active room | Locked | High | Real load data proves a single room exceeds one object’s practical capacity. |
| Random `newUniqueId()` object identity | Locked | High | Cloudflare materially changes the recommended API. |
| SQLite-backed DO storage | Locked | High | Cloudflare materially changes or deprecates the backend. |
| Hibernatable WebSockets | Locked | High | Real-device reliability is unacceptable. |
| One alarm for the current phase | Locked | High | A future game mode requires multiple independent deadlines. |
| Snapshot plus journal recovery | Locked | High | Measured evidence supports a safer equivalent. |
| D1 owns global records | Locked | High | Query scale or product needs materially exceed D1. |
| Worker-owned username/PIN auth | Locked | Medium–High | Public-beta recovery or support needs justify a different identity model. |
| Six-digit PIN | Locked | High | A stronger credential UX replaces PINs. |
| Scrypt preferred, runtime-tested | Locked | Medium–High | Workers compatibility or measured CPU limits require a provider-level migration. |
| HMAC short-code lookup | Locked | High | Spoken room codes are removed. |
| Opaque WS connection ticket | Locked | High | A safer equally private connection mechanism is demonstrated. |
| Supabase optional and disabled | Locked | High | Reporting or integration requirements provide measurable value. |
| Queue deferred | Provisional | Medium | Archival or analytics fan-out becomes unreliable without it. |
| R2 deferred | Locked for v1 | High | User-uploaded files are introduced. |
| Free plan for alpha | Provisional | Medium | Measured usage or limits require Workers Paid. |

## 28. Official implementation references

These are operational references, not substitutes for tests. Recheck them during implementation because APIs, compatibility flags, limits and pricing can change.

- Workers Static Assets: https://developers.cloudflare.com/workers/static-assets/
- Durable Objects overview: https://developers.cloudflare.com/durable-objects/
- Durable Object namespace and IDs: https://developers.cloudflare.com/durable-objects/api/namespace/
- Hibernatable WebSockets: https://developers.cloudflare.com/durable-objects/best-practices/websockets/
- Durable Object alarms: https://developers.cloudflare.com/durable-objects/api/alarms/
- SQLite-backed Durable Object storage: https://developers.cloudflare.com/durable-objects/api/sqlite-storage-api/
- Durable Object limits: https://developers.cloudflare.com/durable-objects/platform/limits/
- Durable Object pricing: https://developers.cloudflare.com/durable-objects/platform/pricing/
- D1 limits: https://developers.cloudflare.com/d1/platform/limits/
- D1 pricing: https://developers.cloudflare.com/d1/platform/pricing/
- Turnstile: https://developers.cloudflare.com/turnstile/
- Workers Node.js compatibility: https://developers.cloudflare.com/workers/runtime-apis/nodejs/
- Workers testing/Vitest integration: https://developers.cloudflare.com/workers/testing/vitest-integration/

## 29. Approval and binding effect

This document is the sole binding architecture direction for deploying MafiYaar on Cloudflare.

Implementation may refine:

- Class names
- Internal table names
- Indexes
- File organization
- Reversible adapter details

Implementation may not change without a written v1.1 revision:

- Platform ownership
- One-room/one-Durable-Object authority
- Secret-state boundary
- Deadline model
- Random object identity and private routing
- Snapshot/journal recovery model
- Client-authority prohibition
- Single Worker deployment shape
- D1 ownership
- Staging/production separation
- Completion gates

### Final approved direction

A single Cloudflare Worker serving MafiYaar’s PWA and APIs; one randomly identified, SQLite-backed Durable Object per active room using Hibernatable WebSockets, snapshot-plus-journal recovery and idempotent alarms; D1 for accounts, sessions, room-directory records, completed matches and statistics; HMAC-protected spoken room-code lookup; opaque short-lived WebSocket connection tickets; Turnstile for suspicious activity; Supabase retained only as an optional future reporting adapter; and the existing Node system preserved as a regression target and local fallback.

**Owner approval:** ______________________________  
**Date approved:** _______________________________
