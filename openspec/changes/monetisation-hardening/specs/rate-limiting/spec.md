## MODIFIED Requirements

### Requirement: D1-backed fixed-window counters
The system SHALL persist rate-limit counters in the D1 `rate_limits` table as fixed windows keyed by prefixed strings — auth under `ip:<address>` at 10 per minute, invite under `ws:<workspaceId>` at 10 per hour, and import under `imp:<workspaceId>` at 20 per hour — with window timestamps computed application-side, SHALL increment allowed attempts atomically, SHALL refuse over-limit attempts without incrementing their counter, SHALL respond to every refusal with an explicit error (never a silent no-op or an unexplained 500), and SHALL behave identically across isolates.
**Source**: BRD §5 NFR-02 (10/min/IP auth, 20/hour/workspace import, 10/hour/workspace invite); brainstorm 2026-11-05 §2.4 (decided storage); ITA §11.9; USER-STORIES US-02, US-45, US-52

#### Scenario: Auth limit enforced fleet-wide
- **WHEN** an 11th auth attempt arrives within one minute from one IP address
- **THEN** it is refused with the standard 429 Bahasa Indonesia message while other IP addresses and the next window remain unaffected

#### Scenario: Import limit keyed by workspace
- **WHEN** more than 20 imports are attempted within one hour for the same workspace
- **THEN** further imports are refused with the standard 429 message, existing data is unaffected, and other workspaces' windows are independent

#### Scenario: Counter survives isolate replacement
- **WHEN** an attempt is counted in one isolate and the next attempt for the same key arrives at a different isolate
- **THEN** both count against the same window, with no per-isolate reset or multiplier

#### Scenario: Invite limit keyed by workspace
- **WHEN** invite sends are counted for two different workspaces
- **THEN** each workspace's 10-per-hour window is tracked independently under its own `ws:` key

#### Scenario: Denied attempts do not write
- **WHEN** an attempt is refused because its window is already at the limit
- **THEN** no counter increment is written for that attempt, bounding attacker-driven writes

#### Scenario: Expired windows do not accumulate
- **WHEN** windows expire while new attempts are recorded
- **THEN** expired counter rows are swept by the write path so storage stays bounded without any cron or background job

## ADDED Requirements

### Requirement: Rate-limit rejections are explicit and tell the user when to retry
When a request is rejected for exceeding a limit (auth: 10 per minute per IP; import: 20 per hour per workspace), the response SHALL be an explicit error carrying a clear Bahasa Indonesia message that states the limit that was exceeded and when to retry. The rejection SHALL render as that message in the relevant screen (auth form / import screen) — never a mysterious dead button, never a silent no-op, never an unexplained 500 — and existing workspace data SHALL be unaffected.

#### Scenario: Auth rate limit message
- **WHEN** more than 10 auth attempts per minute arrive from one IP
- **THEN** a clear Bahasa Indonesia message states the limit and the retry timing on the auth screen

#### Scenario: Import rate limit message
- **WHEN** more than 20 imports per hour are attempted in one workspace
- **THEN** the import screen shows the same style of clear message stating the limit and retry timing, and existing data is unaffected

#### Scenario: Rejection is explicit
- **WHEN** any rate-limited request is rejected
- **THEN** the rejection is explicit — never a silent no-op or an unexplained 500
