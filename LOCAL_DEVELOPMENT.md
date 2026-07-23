# Local Development

## Requirements

- Node.js 22.5 or newer
- npm
- Current pinned development dependencies from `package-lock.json`

## Setup

```bash
npm install
cp .dev.vars.example .dev.vars
npm run d1:migrate:local
npm run dev
```

The local Worker uses local D1 and Durable Object storage. `.dev.vars` must contain only local development secrets and is ignored by Git and release packaging.

## Multi-client test

1. Create at least five accounts in separate browser profiles.
2. One account creates a room.
3. Other accounts join through the five-character room code.
4. Keep all windows connected through role reveal, night, discussion, vote and summary.
5. Test background/return by closing one socket tab and reopening it.

## Reset

Remove `.wrangler/state` only in local development. Never run destructive reset commands against staging or production.
