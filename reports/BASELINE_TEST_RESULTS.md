# Baseline Test Results

**Reference runtime:** Existing Node/Fable implementation

Executed after the Cloudflare port changes:

- Build: PASS
- Full test orchestration: PASS, 13/13 stages
- Executable Node tests: 64 PASS
- Deterministic Equal Action configurations: 72 PASS
- Realtime matches: 6, 12 and 20 clients PASS
- Security tests: 14 PASS

The Node reference remained independently launchable and was not modified by the Cloudflare workspace.
