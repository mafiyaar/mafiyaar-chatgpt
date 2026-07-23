# 06 — Authentication

Accounts use normalized usernames, display names and six-digit PINs. PIN records are versioned scrypt hashes with unique salt and a Worker-secret pepper. Sessions are opaque rotating tokens; D1 stores only digests. State-changing HTTP requests require CSRF and valid origin. WebSockets require an opaque short-lived room/member/session-bound ticket.
