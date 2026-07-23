# 10 — Static Assets and PWA

The Worker and frontend deploy together through Workers Static Assets. `run_worker_first` protects API, WebSocket, health, version and join routes from SPA fallback. The PWA includes manifest, icons and a service worker. Active-match clients are never forced to refresh into an incompatible version.
