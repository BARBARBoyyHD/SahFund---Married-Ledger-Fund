# rate-limiting — delta spec for change `auth-workspace-invite`

## ADDED Requirements

### Requirement: D1-backed fixed-window counters
**Source**: BRD §5 NFR-02 (10/min/IP auth, 10/hour/workspace invite); brainstorm 2026-11-05 §2.4 (decided storage); ITA §11.9; USER-STORIES US-02, US-52
The system SHALL persist rate-limit counters in the D1 `rate_limits` table as fixed windows keyed by prefixed strings — auth under `ip:<address>` at 10 per minute and invite under `ws:<workspaceId>` at 10 per hour — with window timestamps computed application-side, SHALL increment allowed attempts atomically, SHALL refuse over-limit attempts without incrementing their counter, and SHALL behave identically across isolates.

#### Scenario: Auth limit enforced fleet-wide
- **WHEN** an 11th auth attempt arrives within one minute from one IP address
- **THEN** it is refused with the standard 429 Bahasa Indonesia message while other IP addresses and the next window remain unaffected

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
