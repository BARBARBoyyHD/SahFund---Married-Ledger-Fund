# User Stories — SahFund

**Version:** 0.1
**Date:** 2026-11-03
**Status:** Draft
**Derived from:** BRD v0.1 (`BRD §N`), ITA v0.1 (`ITA §N`), PEP v0.1 (`PEP §N`)
**Scope guard:** AGENTS.md §10 / BRD §3 — v1.0 exclusions are respected; see §3.

---

## 1. How to read this document

- **Format:** every story is written as *As a \<role\>, I want \<action\>, so that \<benefit\>* with testable **Given/When/Then** acceptance criteria.
- **IDs:** `US-nn`, unique and sequential, grouped under epics. IDs are stable — do not renumber; retire instead.
- **Source:** every story cites the BRD requirement (`FR-xx`, `NFR-xx`) or BRD section it derives from. Where a requirement exists only in ITA/PEP/AGENTS.md, that is stated explicitly. Where **no** document states the requirement at all (scope-inferred pages such as the landing page and the 404), the story says so and Appendix B flags it — no FR number is invented.
- **Traceability:** Appendix A maps every BRD FR and NFR to its stories. Appendix B lists ambiguities and cross-document conflicts — nothing in scope is silently dropped, nothing excluded is silently included.
- **Not stories:** BRD §2 business objectives (e.g. "≥ 80% of transactions from import") are success metrics measured *over* these stories, not stories themselves. NFR-05 (portability) and NFR-10 (cost) are engineering constraints with no user-visible behaviour and therefore carry no story.

## 2. Roles

v1.0 defines exactly two in-app roles: **owner** and **member** (BRD §3, "Roles beyond owner and member" is out of scope). No in-app admin exists.

| Role | Who they are | In-app role |
|---|---|---|
| **Prospective user (guest)** | Unauthenticated visitor: reads pricing, signs up, or opens a shared report link | none |
| **Partner / owner** | The workspace creator: pays the one-time entitlement, rotates the invite code, deletes the workspace | `owner` |
| **Member** | The invited second partner; sees and edits the same fund as the owner | `member` |
| **Shared viewer** | Family member or wedding organizer (WO) opening a read-only share link; has **no account and no membership** — the link is not a role grant (BRD §3 excludes WO multi-client mode) | none |
| **Operator** | The person running SahFund (PEP §2 delivery roles); operates outside the app — not an in-app admin | none |

Roles are equal in capability unless a story says otherwise: BRD §4 does not restrict ledger, import, or reporting actions to the owner; only code rotation, entitlement purchase context, sharing, and deletion are owner actions (FR-02, FR-11, FR-12).

## 3. Scope guard — v1.0 exclusions (no stories written)

Per BRD §3 / AGENTS.md §10, the following are **excluded** and deliberately have no stories: OCR / scanned-photo statements · screenshot or notification capture · bank API integration · subscription or recurring billing · multi-currency · any storage of documents, images, or avatars · LLM-based categorisation · native mobile apps · digital invitations, guest list, RSVP, seating chart · vendor marketplace/directory/payments · roles beyond owner/member · wedding-organizer multi-client mode · KV/R2/D1/server-side session cache.

Notes:

- **Bank Jago PDF import is in scope and is not OCR** — it uses the PDF *text layer* only (BRD §3, FR-03, ITA ADR-05). Statements without a text layer are a parse failure (US-44), not a cue to add OCR.
- **Email is in scope for invitations only** (FR-13, ITA ADR-12): no welcome email, no share-report email, no notifications, text-only content with no attachments — nothing that would store a document (NFR-01).
- **A wedding organizer may *view* a shared report (US-33)**; that is a token-based read-only link, not the excluded "multi-client mode".
- **Payment:** one-time entitlement only (FR-12). No subscription story exists; the purchase *mechanism* is an open question (Appendix B-3).

**PEP §10 cut order (if the schedule slips):** first cuts are share link (US-32–34), pricing page (US-36), CSV in the UI (US-10), payee rules (US-23). **Never cut:** reconciliation (US-14–17), deletion (US-39–40), Jago import (US-09), server-side session checks (US-04).

---

## 4. Epics overview

| # | Epic | Story IDs | Count | Primary source |
|---|---|---|---|---|
| E0 | Entry & Auth Pages *(ordered first)* | US-54–US-56 | 3 | BRD-derived / scope-inferred: §1, FR-01, FR-12, NFR-04, NFR-07, NFR-08, NFR-09 |
| E1 | Authentication & Session | US-01–US-04 | 4 | BRD FR-01, NFR-02 |
| E2 | Workspace & Invite | US-05–US-08, US-52–US-53 | 6 | BRD FR-02, FR-13 |
| E3 | Statement Import | US-09–US-13 | 5 | BRD FR-03, NFR-01 |
| E4 | Reconciliation | US-14–US-17 | 4 | BRD FR-04 |
| E5 | Ledger & Manual Entry | US-18–US-21 | 4 | BRD FR-05 |
| E6 | Categories & Rules | US-22–US-23 | 2 | BRD FR-06 |
| E7 | Reporting & Forecast | US-24–US-31 | 8 | BRD FR-07–FR-10 |
| E8 | Share Report | US-32–US-34 | 3 | BRD FR-11 |
| E9 | Entitlement & Purchase | US-35–US-38 | 4 | BRD FR-12, §7 Phase 4 |
| E10 | Deletion & Privacy | US-39–US-42 | 4 | BRD FR-12, NFR-01, NFR-06 |
| E11 | Errors & Resilience | US-43–US-46 | 4 | BRD NFR-07, NFR-02 |
| E12 | Accessibility, Localisation & Performance | US-47–US-51 | 5 | BRD NFR-03, NFR-04, NFR-08, NFR-09 |
| | **Total** | | **56** | |

---

## 4a. Epic E0 — Entry & Auth Pages

*Placed first in the story ordering (before E1) — these are the pages a prospective user meets before any workspace exists. Existing epic numbering (E1–E12) and section numbers are unchanged.*

### US-54 — Landing page

**As a** prospective user (guest), **I want** a landing page that explains what SahFund is and leads me to sign up, **so that** I can judge in seconds whether it fits our wedding fund.

- **Given** an unauthenticated visit to the site root, **When** the page loads, **Then** it explains in Bahasa Indonesia what SahFund is — a two-person wedding-fund tracker for Indonesian couples: import the bank statement, reconcile it against the printed balance, and see the forecast — with one primary call to action leading to sign-up.
- **Given** any price or entitlement claim on the page, **When** it renders, **Then** it matches FR-12 exactly: one-time charge per wedding, Rp 49.000 introductory / Rp 99.000 list — no subscription or recurring language, and no claim the BRD does not make (no feature, guarantee, or bank-partnership claims beyond §1/§3).
- **Given** any money figure shown, **When** it renders, **Then** it uses the shared money module in `Rp 1.234.567` form — never `$`, never `en-US` grouping.
- **Given** the primary CTA, **When** I activate it, **Then** I am taken to the auth page in sign-up mode (US-55); rendering the page requires no session, no workspace data, and no client-side data fetching.
- **Given** a mobile-first layout on a 4G connection, **When** the page loads, **Then** it renders within 1.5 s p95 — the NFR-04 dashboard budget applied to the landing page by analogy (derived; BRD sets no separate landing-page target) — with no desktop-only content or horizontal scroll on a phone.
- **Given** keyboard-only or screen-reader use, **When** I navigate the page, **Then** it meets WCAG 2.2 AA: labelled controls, ≥ 4.5:1 contrast, correct heading order, and a visible focus path to the CTA.

**Source:** scope-inferred — no BRD FR names a landing page (Appendix B-13). Derived from BRD §1 (what SahFund is), BRD §3 In Scope (account creation and sign-in), BRD §4 FR-01 (the sign-up it routes to), FR-12 (price claim, if shown), BRD §5 NFR-04 (budget applied by analogy), NFR-08, NFR-09; CTA/visual conventions per `docs/ui/DESIGN.md` (one primary button per view).

### US-55 — Auth page (sign in and sign up on one page)

**As a** prospective user or returning member, **I want** one auth page offering both sign-up and sign-in, **so that** I can get in without hunting for the right URL.

- **Given** the auth page with no session, **When** it loads, **Then** both modes are offered on the page with a clear switch between them: sign-up collects `name`, `email`, `password` (minimum 10 characters) and sign-in collects `email` and `password` — exactly the FR-01 fields; the route stays `/login`, the redirect target already established by US-03.
- **Given** either form, **When** I submit, **Then** client and server validate the same payload with one shared Zod schema; invalid input shows inline field errors in Bahasa Indonesia and no session is created.
- **Given** a submission in flight, **When** the server has not answered, **Then** the submit button is disabled — no double submission.
- **Given** a failing server response (bad credentials per US-02, rate limit per US-45, any 5xx), **When** it returns, **Then** the server's message is rendered verbatim in Bahasa Indonesia — never swallowed into a toast-only message, never replaced by a fake success, and never with account-enumeration detail.
- **Given** a successful sign-up, **When** it completes, **Then** the session cookie is `httpOnly`, `Secure` in production, `SameSite=Lax`, and I am directed to workspace creation — account creation stays in US-01 and workspace creation in US-05 (E1/E2); this story does not duplicate them.
- **Given** a successful sign-in, **When** it completes, **Then** I am redirected to the dashboard exactly as specified in US-02.
- **Given** keyboard-only use of either mode, **When** I complete the flow, **Then** every field has a `<label>`, errors are announced via `aria-describedby`/`aria-live`, and the flow meets WCAG 2.2 AA — NFR-08 names forms explicitly.

**Source:** BRD §4 FR-01 (fields, endpoints, server-side session), BRD §5 NFR-02 (auth rate limit), NFR-08 (forms), NFR-09 (Bahasa Indonesia copy); session-cookie attributes per AGENTS.md §9; one shared Zod schema per AGENTS.md §6 / ITA §3. Single-page two-mode layout is an interpretation — Appendix B-14. Account/workspace creation behaviour itself is US-01/US-05, not restated here.

### US-56 — 404 (page not found)

**As a** visitor who followed a bad or stale link, **I want** a clear "page not found" in Bahasa Indonesia with a way back, **so that** I never hit a dead end, a blank screen, or an error dump.

- **Given** any unknown or malformed URL, **When** it is requested (signed in or signed out), **Then** the not-found route renders a Bahasa Indonesia message — never a framework default page, never a blank screen, never a stack trace.
- **Given** the 404 page, **When** it renders, **Then** it offers a clear path back: a link to the home/landing page (US-54) and, when a session exists, to the dashboard; rendering it requires no data fetch, so no loading state is needed.
- **Given** a missing route versus a failed request, **When** either renders, **Then** the missing route shows this 404 state, not the US-43 database-error state and not a 500-style message — the two are distinct screens (NFR-07's "explicit error, no blank screen" holds for both).
- **Given** NFR-08 and NFR-09, **When** the page renders, **Then** the copy is Bahasa Indonesia, heading order and link focus are correct, contrast is ≥ 4.5:1, and the way-back link is reachable by keyboard alone.

**Source:** derived — no BRD requirement names a 404 page (Appendix B-13). From BRD §5 NFR-07 (never a blank screen), NFR-08, NFR-09; four-state/screen rules per AGENTS.md §6 (a static 404 satisfies them with an explicit error state and no fetch).

---

## 5. Epic E1 — Authentication & Session

### US-01 — Sign up

**As a** prospective user, **I want** to create an account with my name, email, and password, **so that** I have a personal identity in SahFund and can start a workspace.

- **Given** the sign-up form, **When** I submit a name, a unique email, and a password of at least 10 characters, **Then** my account is created, a session is established, and I am directed to workspace creation.
- **Given** the sign-up form, **When** I submit a password shorter than 10 characters or an email that already exists, **Then** no account is created and an inline field error in Bahasa Indonesia explains the problem.
- **Given** my account, **When** it is created, **Then** `name` is stored as my display name and is shown as the contributor name in attribution views.

**Source:** BRD §4 FR-01.

### US-02 — Sign in

**As a** registered user, **I want** to sign in with my email and password, **so that** I can reach my workspace.

- **Given** a registered account, **When** I submit correct credentials, **Then** a session cookie is set and I am redirected to my dashboard.
- **Given** a registered account, **When** I submit a wrong password repeatedly (more than 10 attempts per minute per IP), **Then** the attempt is rate limited with a clear Bahasa Indonesia message and no account-enumeration detail is revealed.
- **Given** an unknown email or wrong password, **When** I submit the form, **Then** a single generic error is shown; details go to logs only.

**Source:** BRD §4 FR-01, BRD §5 NFR-02.

### US-03 — Sign out

**As a** user on a shared or borrowed device, **I want** to sign out, **so that** my fund data cannot be opened after I leave.

- **Given** an active session, **When** I sign out, **Then** the session cookie is cleared.
- **Given** no session, **When** I request `/dashboard`, **Then** I am redirected to `/login` and no workspace data is rendered.

**Source:** BRD §4 FR-01.

### US-04 — Server-side session and membership enforcement

**As a** member, **I want** every protected page and mutation to verify my session and workspace membership on the server, **so that** nobody can reach our fund by guessing URLs or bypassing the redirect.

- **Given** an unauthenticated request to any protected page or route handler, **When** it arrives, **Then** it is rejected or redirected server-side — the edge redirect alone never authorises access.
- **Given** a signed-in user who is not a member of workspace W, **When** they request W's data (by URL id or API), **Then** the request is denied and no row is returned.
- **Given** a session cookie, **When** it is expired or forged, **Then** the request is treated as unauthenticated.

**Source:** BRD §4 FR-01 ("Session must be validated server-side on every protected page and route handler"), BRD §5 NFR-02; reinforced by ITA §7 / ADR-11.

---

## 6. Epic E2 — Workspace & Invite

### US-05 — Create a workspace

**As a** partner (founder), **I want** to create our shared workspace with a name and optional wedding date and budget target, **so that** both of us track one fund.

- **Given** the workspace form, **When** I submit a name (e.g. "Nikah Ayu & Budi") plus optional `weddingDate` and `budgetTarget`, **Then** the workspace is created, I become its only member (owner), and a 10-character pocket code (4 digits + 3 letters + 3 alphanumeric, e.g. `4821kPz7xQ`) is returned.
- **Given** a created workspace, **When** no wedding date was supplied, **Then** the dashboard prompts me to set it rather than showing a broken forecast.
- **Given** a `budgetTarget`, **When** it is stored, **Then** it is held as an integer minor-unit amount (no floats).

**Source:** BRD §4 FR-02; BRD §3 In Scope; BRD §5 NFR-03.

### US-06 — Join by pocket code

**As an** invited partner, **I want** to join the workspace with the pocket code, **so that** we both see the same fund.

- **Given** a valid pocket code (10 characters: 4 digits + 3 letters + 3 alphanumeric), **When** I submit it while signed in, **Then** a membership row is created and I see the shared dashboard.
- **Given** a malformed code (wrong length or wrong structure, e.g. letters where digits belong), **When** I submit it, **Then** an inline Bahasa Indonesia error rejects the format before any lookup or write occurs.
- **Given** a workspace that already has two members, **When** anyone submits the code (even concurrently), **Then** the third join is refused with a clear Bahasa Indonesia message — never a silent failure or a duplicate membership.
- **Given** I am already a member of that workspace, **When** I submit the code again, **Then** I am told I am already a member and no duplicate membership row is created.
- **Given** an unknown or rotated code, **When** I submit it, **Then** I receive a clear "code not valid" message.

**Source:** BRD §4 FR-02 (two-member cap, clear message; pocket code format). Already-member behaviour derives from the `UNIQUE (workspaceId, userId)` constraint (ITA §5).

### US-07 — Rotate the invite code

**As a** workspace owner, **I want** to rotate the invite code, **so that** a code shared in the wrong chat stops working.

- **Given** an owner session, **When** I rotate the code, **Then** a new 10-character pocket code in the same format is issued, the previous code is immediately invalid, and existing membership is unchanged.
- **Given** an invite email containing the old code, **When** the code has been rotated, **Then** that code no longer joins (US-06 "code not valid") — including a join link opened from the old email.
- **Given** a non-owner member, **When** they attempt rotation, **Then** the action is refused (owner-only action).

**Source:** BRD §4 FR-02 ("rotatable by the owner"). Owner-only restriction is an interpretation — see Appendix B-6.

### US-08 — Set or update the wedding date and budget target

**As a** member, **I want** to set or change the wedding date and budget target after creation, **so that** the forecast and report targets reflect reality.

- **Given** a workspace without a wedding date, **When** I set it (from the dashboard prompt or settings), **Then** the forecast becomes available using that date.
- **Given** a set wedding date, **When** I change it, **Then** subsequent forecasts recompute against the new date and no other data changes.
- **Given** a budget target, **When** I update it, **Then** the report's "of target" figure reflects the new value formatted as IDR.

**Source:** BRD §4 FR-02 (fields and dashboard prompt); edit path not specified in BRD — see Appendix B-6.

### US-52 — Send a pocket invite by email (Resend)

**As a** workspace owner, **I want** to invite my partner by email so the invitation arrives in their inbox, **so that** I do not have to coordinate getting the code to them out of band.

- **Given** an owner session on the invite screen, **When** I submit my partner's email address, **Then** an invite email is sent through Resend containing the pocket code and a join link (text only, Bahasa Indonesia, no attachments and no financial data), and the screen confirms it was sent.
- **Given** an invite send that fails (Resend error, missing `RESEND_API_KEY`, network), **When** the send does not go through, **Then** the invite itself is unaffected: the response reports the failure, and the screen shows the pocket code and join link for manual copying **plus** a retry button — a dead button or a silent swallow of the error is a bug.
- **Given** more than 10 invite sends in one workspace in one hour, **When** the limit is exceeded, **Then** the send is refused with the same clear Bahasa Indonesia rate-limit message style as US-45, and existing membership is unaffected.
- **Given** any invite attempt, **When** it is logged, **Then** neither the pocket code nor the recipient's email address appears in the log output.

**Source:** BRD §4 FR-13 (Resend, fallback + retry, invitations-only), BRD §4 FR-02, BRD §5 NFR-02 (10/hour/workspace); ITA §6 / §7 / ADR-12, ITA §11.9 log hygiene.

### US-53 — Join from the invite email link

**As an** invited partner, **I want** to open the link in the invite email and join, **so that** joining takes one confirmation instead of tracking down a code.

- **Given** an invite email, **When** I open the join link and sign in, **Then** the pocket code is pre-filled and one confirmation creates my membership and shows the shared dashboard.
- **Given** an email that failed to send (US-52), **When** my partner copies the pocket code or join link and shares it with me directly, **Then** I can join with it exactly as with the emailed link — the code alone is the credential.
- **Given** a code that has been rotated since the email was sent, **When** I submit it, **Then** I get the clear "code not valid" message of US-06, not an error dump or a broken screen.
- **Given** a workspace that already has two members, **When** I open the link and confirm, **Then** the join is refused with the clear full-workspace message of US-06.
- **Given** an invite email, **When** I read it, **Then** it carries no financial data and no attachment — only the code, the link, and explanatory copy.

**Source:** BRD §4 FR-02 (join), FR-13 (invite email content, fallback path); BRD §5 NFR-01.

---

## 7. Epic E3 — Statement Import

### US-09 — Import a Bank Jago PDF statement (parsed on my device)

**As a** partner with a Jago e-statement, **I want** to select the PDF on my device and have its rows extracted in the browser, **so that** my statement file never leaves my device.

- **Given** a Jago PDF with a text layer, **When** I choose the file, **Then** extraction runs in the browser and a preview of normalised rows is produced — only derived rows + reconciliation JSON are ever sent to the server.
- **Given** any import, **When** it completes, **Then** no file bytes are uploaded, stored, or logged anywhere in the system (document, image, or avatar storage does not exist).
- **Given** a PDF with no text layer (scanned image), **When** I select it, **Then** parsing fails with a clear message and nothing is persisted — the product never attempts OCR.

**Source:** BRD §4 FR-03, BRD §3 In Scope, BRD §5 NFR-01, ITA §2 / ADR-05.

### US-10 — Import a CSV/XLSX statement from another bank via column mapping

**As a** partner whose bank is not Jago, **I want** to map my CSV/Excel columns to SahFund fields, **so that** I can still import my statement.

- **Given** a `.csv` or `.xlsx` export, **When** I map the date, description, amount, balance (and optional ref/time) columns, **Then** rows are parsed into the same canonical statement shape as a Jago import.
- **Given** a mapped file, **When** parsing succeeds, **Then** the preview, reconciliation gate, and dedupe behave exactly as for Jago — nothing downstream knows which bank produced the file.
- **Given** an unmappable or malformed file, **When** I attempt mapping/parsing, **Then** I get a clear error naming the offending input and nothing is persisted.

**Source:** BRD §3 In Scope (CSV/Excel via column mapping), BRD §4 FR-03; adapter parity per BRD §6 / ITA ADR-06. *PEP §10 cut candidate #3.*

### US-11 — Choose the pocket and period

**As a** partner importing a multi-pocket statement, **I want** to choose which pocket (e.g. "Kantong Nikah") and confirm the period, **so that** only the fund we care about is imported.

- **Given** a statement containing several pockets, **When** I open the preview, **Then** I can select the pocket to import; totals shown belong to the selected pocket.
- **Given** a statement whose period is detectable, **When** the preview loads, **Then** the period (e.g. "April 2026") is pre-filled and I can override it.

**Source:** BRD §4 FR-03 (pocket required, period optional/from document), BRD §9 import wireframe.

### US-12 — Preview and commit an import

**As a** member, **I want** to see what an import contains before committing it, **so that** I never add rows blindly.

- **Given** a parsed statement, **When** the preview renders, **Then** it shows the reconciliation result, the count of new transactions, and the count of duplicates (e.g. "34 transaksi baru · 0 duplikat").
- **Given** a preview, **When** I confirm, **Then** the import and its rows are persisted atomically — a partial import (import row without its transactions) is impossible.
- **Given** a file with more than 5,000 rows, **When** I attempt to import it, **Then** it is rejected with a clear message stating the 5,000-row limit; the server validates the payload against the shared Zod schema either way.

**Source:** BRD §4 FR-03 (validate → dedupe → persist → respond; max 5,000 rows), BRD §9; atomicity per ITA §2 / AGENTS.md §2.

### US-13 — Re-importing a month is safe (idempotent)

**As a** member, **I want** to re-import a statement I already imported — or an overlapping month — **so that** my balances never double.

- **Given** rows already stored for this workspace, **When** I post the same (or overlapping) rows again, **Then** duplicates are dropped by dedupe hash, the import succeeds as a no-op for those rows, and totals are unchanged.
- **Given** two partners importing the same overlapping month simultaneously, **When** both requests complete, **Then** both succeed and the unique index removes the overlap — no locks, no errors, no doubled balance.
- **Given** a duplicate-filtered import, **When** the preview counts are shown, **Then** duplicates are reported, not silently swallowed.

**Source:** BRD §4 FR-03 (dedupe step); ITA §5 dedupe hash, AGENTS.md §3.

---

## 8. Epic E4 — Reconciliation

### US-14 — See the "Cocok dengan saldo bank" state

**As a** member, **I want** my imported rows proven against the balance the bank printed, **so that** I trust the numbers before they enter reports.

- **Given** a statement where opening + money in − money out equals the printed closing balance within Rp 1, and totals within Rp 0.05, **When** the preview computes reconciliation, **Then** the green "Cocok dengan saldo bank" state is shown with Saldo awal, Masuk, Keluar, and Saldo akhir.
- **Given** a tampered amount in the rows, **When** reconciliation runs, **Then** `ok` is false and the balance-chain or totals issue is reported — never a false green state.

**Source:** BRD §4 FR-04 (tolerances, green state).

### US-15 — Understand and resolve a reconciliation failure

**As a** member, **I want** to see exactly why the numbers do not match, **so that** I can fix my file or knowingly continue.

- **Given** a mismatch, **When** the preview computes reconciliation, **Then** issues are listed by kind (`balance_chain`, `totals`, `opening`, `duplicate`, `empty`) with human-readable messages, including the offending line where applicable (e.g. "13 Apr 2026 11:55 saldo seharusnya Rp 210, tertulis Rp 226").
- **Given** listed issues, **When** I choose "Batal", **Then** nothing is persisted.
- **Given** listed issues, **When** I choose to continue, **Then** the import is recorded with `reconciled = false` and its issues, and it is **never silently** included in trusted reports.

**Source:** BRD §4 FR-04, BRD §9 failure wireframe; persistence behaviour per ITA §2.

### US-16 — The server independently re-verifies reconciliation

**As a** member, **I want** the server to re-run the same reconciliation math on the rows I post, **so that** a manipulated browser cannot fake a "Cocok" result.

- **Given** a posted import payload with a client-computed `reconciliation` field, **When** the server validates it, **Then** the server recomputes reconciliation with the same single implementation and stores the **server** result as authoritative.
- **Given** a client result that disagrees with the server's, **When** the import is stored, **Then** the server's verdict governs the green state and trusted totals.

**Source:** BRD §4 FR-04 (green state only when `ok`); server re-check per ITA §2, AGENTS.md §3/§7 ("never trust the client").

### US-17 — Confirm a flagged import before it becomes final

**As a** member, **I want** to explicitly confirm a non-reconciling import, **so that** suspect data only enters my reports when I say so.

- **Given** an import stored with `reconciled = false`, **When** I have not confirmed it, **Then** it is excluded from trusted totals and visibly flagged in the UI.
- **Given** that flagged import, **When** I explicitly confirm it, **Then** it is treated as final for totals while remaining visibly marked "belum cocok" with its issues.
- **Given** any flagged import, **When** reports are computed, **Then** its inclusion or exclusion always follows this rule — a failed import is never silently mixed into trusted numbers.

**Source:** BRD §4 FR-04 ("confirm before the data is treated as final"; "never silently included in reports"), ITA §2. Interpretation note: Appendix B-7.

---

## 9. Epic E5 — Ledger & Manual Entry

### US-18 — Browse the ledger

**As a** member, **I want** to browse all transactions chronologically, **so that** I can see where the money went.

- **Given** transactions in the workspace, **When** I open the ledger, **Then** they are listed newest-first with date, description, signed amount (IDR-formatted), category, member, and direction.
- **Given** a workspace with thousands of rows, **When** the ledger loads, **Then** the list is paginated or virtualised — never all rows rendered into the DOM at once.
- **Given** no transactions, **When** I open the ledger, **Then** an empty state explains what to do next (import or add manually).

**Source:** BRD §4 FR-05; performance/rendering per AGENTS.md §6.

### US-19 — Filter and search the ledger

**As a** member, **I want** to filter by date range, category, member, and direction, and search by keyword, **so that** I can answer "how much did we spend on catering?" quickly.

- **Given** active filters, **When** the list renders, **Then** only matching rows are returned, filtered and paginated in the query — not fetched-all-then-sliced.
- **Given** a set of filters, **When** the URL is copied or the back button is pressed, **Then** the filter state survives (filters live in search params, not transient component state).
- **Given** a search term, **When** I type it, **Then** matching descriptions are shown with money and dates still formatted via the shared money module.

**Source:** BRD §4 FR-05 (query parameters); URL-as-state per AGENTS.md §6.

### US-20 — Re-categorise or reassign a transaction

**As a** member, **I want** to correct a transaction's category or attributed member, **so that** one mis-parsed row does not distort a report.

- **Given** a transaction with `categoryId = null` (uncategorised by default), **When** I pick a category, **Then** the row updates immediately and totals reflect the change after refresh.
- **Given** a transaction attributed to the wrong member, **When** I change `memberId`, **Then** per-member totals recompute.
- **Given** the correction, **When** it is offered as a payee rule (US-23), **Then** accepting or declining it is my explicit choice.

**Source:** BRD §4 FR-05 (PATCH), FR-06 (correction offered as rule).

### US-21 — Add a manual transaction (cash and other-bank payments)

**As a** member, **I want** to record cash expenses and payments made outside the imported statement, **so that** the ledger reflects reality even though no bank API exists.

- **Given** the manual-entry form, **When** I submit a date, description, and signed amount (positive = money in), **Then** the row is stored with `source = manual`, optional `categoryId` and `memberId`, validated by the same shared Zod schema as the server.
- **Given** a manual row identical to one already imported, **When** I submit it, **Then** the dedupe conflict is surfaced — no duplicate row is created.
- **Given** an invalid submission (missing date/amount), **When** I submit, **Then** inline Bahasa Indonesia field errors appear and nothing is written.

**Source:** BRD §4 FR-05 (POST manual, field defaults); dedupe for manual entry per AGENTS.md §7.

---

## 10. Epic E6 — Categories & Rules

### US-22 — Start with a seeded Indonesian wedding category set

**As a** partner creating a workspace, **I want** sensible wedding categories from day one, **so that** I am not staring at an empty taxonomy.

- **Given** a new workspace, **When** it is created, **Then** the seeded set exists: Catering, Venue, Dekorasi, Busana & Rias, Dokumentasi, Undangan & Souvenir, Seserahan & Mahar, Adat & Prosesi, Transportasi, Lain-lain.
- **Given** the seeded categories, **When** I rename or add a category, **Then** names remain unique within the workspace (a duplicate name is rejected with a clear message).

**Source:** BRD §4 FR-06; uniqueness per AGENTS.md §3.

### US-23 — Turn a category correction into a payee rule

**As a** member, **I want** my category corrections to become payee-to-category rules applied to future imports, **so that** I categorise once instead of every month.

- **Given** I corrected a transaction's category, **When** the correction is offered as a rule and I accept it, **Then** future imports auto-categorise transactions with the same payee.
- **Given** an accepted rule, **When** I re-import a past statement, **Then** already-stored rows are not retroactively rewritten — rules apply to newly imported rows only.
- **Given** a rule I no longer want, **When** I delete it, **Then** future imports no longer apply it; existing rows are untouched.

**Source:** BRD §4 FR-06. *PEP §10 cut candidate #4.*

---

## 11. Epic E7 — Reporting & Forecast

### US-24 — Bulk-attribute transactions to a partner

**As a** member, **I want** to assign a member to many rows at once ("these 12 deposits are Ayu's"), **so that** attribution does not take an hour of clicking.

- **Given** a selection of transactions, **When** I apply a member to the selection, **Then** all selected rows update in one action and per-member totals recompute.
- **Given** a bulk action that partially fails, **When** results are shown, **Then** I am told exactly which rows did or did not update — no silent partial success.

**Source:** BRD §4 FR-07.

### US-25 — See per-member contributions

**As a** member (or the owner presenting to family), **I want** money in, money out, and net position per partner, **so that** "who put in what" is settled by data, not memory.

- **Given** attributed transactions, **When** the contribution report renders, **Then** it shows money in per member, money out per member, and each member's net position, summing exactly in integer minor units.
- **Given** unattributed rows, **When** the report renders, **Then** they are shown as unattributed rather than silently folded into a member's total.

**Source:** BRD §4 FR-07; exactness per BRD §5 NFR-03.

### US-26 — Set per-category budgets

**As a** member, **I want** to set a budget for each category, **so that** spending has a ceiling to compare against.

- **Given** a category, **When** I set its budget (IDR), **Then** it is stored in integer minor units and used by the budget-vs-actual report.
- **Given** a budget target for the whole wedding, **When** budgets are set per category, **Then** the report can show both the category budgets and the overall target without conflicting sources of truth.

**Source:** BRD §3 In Scope ("Categories with per-category budgets"), BRD §4 FR-08.

### US-27 — Read the budget-vs-actual report

**As a** member, **I want** budget, committed, paid, and remaining per category plus a totals row, **so that** I know where we stand without opening a spreadsheet.

- **Given** budgets and commitments, **When** the report renders, **Then** each category shows budget, committed (signed contracts), paid, and remaining, plus a totals row with the same four numbers for the whole wedding.
- **Given** a category over budget, **When** the report renders, **Then** it is marked (e.g. "+500.000") — never hidden or clamped to zero.
- **Given** no data for a category, **When** the report renders, **Then** zeros are shown as real zeros only where the underlying query succeeded; a database failure shows the error state instead (US-43).

**Source:** BRD §4 FR-08, BRD §9 report wireframe.

### US-28 — Add a vendor commitment (DP and pelunasan)

**As a** member, **I want** to record a vendor contract with total, DP paid, and due date, **so that** future obligations are counted even before money moves.

- **Given** the commitments form, **When** I submit vendor, optional category, total, paid, and optional due date, **Then** the commitment is stored independently of any ledger transaction.
- **Given** a commitment, **When** I record a DP and later a pelunasan, **Then** `paid` tracks what has been settled against `total`, with amounts as integer minor units.

**Source:** BRD §4 FR-09 (POST), BRD §3 In Scope (commitments, DP, pelunasan).

### US-29 — See upcoming commitment due dates on the dashboard

**As a** member, **I want** the next due dates listed on the dashboard, **so that** nothing falls due unnoticed.

- **Given** commitments with due dates, **When** the dashboard loads, **Then** the nearest due dates are listed in id-ID date format with IDR amounts.
- **Given** commitments without due dates, **When** the dashboard loads, **Then** they do not break the list and remain visible in the commitments view.

**Source:** BRD §4 FR-09 ("dashboard lists the next due dates").

### US-30 — Surface payments counted twice

**As a** member, **I want** a payment that appears both as a ledger transaction and as commitment `paid` to be visibly reconciled, **so that** my totals are never double-counted.

- **Given** a commitment whose `paid` amount corresponds to a ledger transaction already in the ledger, **When** reports are computed, **Then** the duplication is visibly surfaced to me — it is never silently counted twice and never silently dropped.
- **Given** the surfaced duplication, **When** I review it, **Then** the report state makes clear which figure is included in totals.

**Source:** BRD §4 FR-09 ("must be visibly reconciled"). Exact UX undefined — see Appendix B-2.

### US-31 — Get the funded-or-shortfall forecast

**As a** member asking the only question that matters, **I want** one sentence and one number — how much is still needed and what to set aside each month — **so that** I know if the wedding is funded by its date.

- **Given** current balance, unpaid commitments, remaining budget, a wedding date, and a planned monthly deposit, **When** the forecast runs, **Then** it returns `funded` or `shortfall` with the shortfall amount and the required monthly deposit.
- **Given** a wedding date already past or missing, **When** the forecast is requested, **Then** the UI explains what is missing instead of rendering a misleading number.
- **Given** the forecast output, **When** it renders, **Then** it is one sentence plus one number in Bahasa Indonesia, money formatted `Rp 1.234.567`, and server and UI use the same single forecast implementation.

**Source:** BRD §4 FR-10 (signature and output), BRD §9 report wireframe; single implementation per AGENTS.md §7.

---

## 12. Epic E8 — Share Report

### US-32 — Create a read-only share link

**As a** workspace owner, **I want** to generate an expiring, revocable read-only link, **so that** family or the wedding organizer can see progress without an account.

- **Given** an owner session, **When** I create a share link, **Then** a token, URL, and expiry are returned and the link requires no authentication to view.
- **Given** the shared report, **When** it is opened, **Then** it shows totals, category breakdown, and forecast only — no mutation is possible through the link.

**Source:** BRD §4 FR-11, BRD §3 In Scope. Default TTL undefined — see Appendix B-4.

### US-33 — View a shared report without an account

**As a** family member or wedding organizer (shared viewer), **I want** to open the link and read the report, **so that** I can follow the budget without being given a login.

- **Given** a valid, unexpired token, **When** I open `/r/:token` signed out, **Then** the read-only report renders: totals, category breakdown, forecast.
- **Given** the shared report, **When** it renders, **Then** transaction-level descriptions are excluded by default — only aggregated figures appear.
- **Given** an invalid or expired token, **When** I open it, **Then** I get a clear "link no longer available" page, not an error dump.

**Source:** BRD §4 FR-11.

### US-34 — Revoke a share link

**As a** workspace owner, **I want** to revoke a share link, **so that** access ends the moment I say so.

- **Given** an active share link, **When** I revoke it, **Then** the token immediately stops resolving for any holder of the URL.
- **Given** a revoked link, **When** someone opens it, **Then** they see the same clear unavailable message as for an expired token.

**Source:** BRD §4 FR-11 ("revocable").

---

## 13. Epic E9 — Entitlement & Purchase

### US-35 — Understand the free tier's limits

**As a** prospective user, **I want** the dashboard to work with one free import and to clearly show what unlocking adds, **so that** I can evaluate before paying.

- **Given** a workspace that has never paid, **When** I import my first statement, **Then** it succeeds and the dashboard is fully visible.
- **Given** the free state, **When** I attempt a second import or an export, **Then** each is locked with a clear message explaining that a one-time purchase unlocks unlimited imports and export for this workspace — never a silent failure.
- **Given** the free state, **When** I look at any locked action, **Then** my data already imported remains fully visible and intact.

**Source:** BRD §4 FR-12 (free state).

### US-36 — See the one-time price

**As a** prospective user, **I want** a pricing page stating one price for the whole wedding, **so that** there are no subscription surprises.

- **Given** the pricing page, **When** I load it, **Then** it states the one-time price (Rp 49.000 introductory / Rp 99.000 list) and that it is charged once per wedding — no recurring or subscription language.
- **Given** the pricing page, **When** I read it, **Then** the privacy position (statement never leaves my device, nothing stored) is stated alongside the price.

**Source:** BRD §4 FR-12 (price), BRD §7 Phase 4 (pricing page), BRD §8 (billing model). *PEP §10 cut candidate #2.*

### US-37 — Buy once and unlock the workspace

**As a** partner ready to pay, **I want** a one-time purchase that unlocks unlimited imports and export for our workspace, **so that** we pay once and the product keeps working until the wedding.

- **Given** a completed purchase (Rp 49.000 or Rp 99.000), **When** the entitlement is granted, **Then** unlimited imports and export unlock for that workspace and no further charge is ever requested.
- **Given** a webhook or grant that is retried, **When** the same order id arrives more than once, **Then** the grant is processed at most once — entitlement is idempotent per order.
- **Given** an in-flight or failed payment, **When** the outcome is uncertain, **Then** my workspace stays in its previous state; no partial unlock occurs and the error is shown, not swallowed.

**Source:** BRD §4 FR-12 (paid state, price, one-time charge); idempotency per ITA §6, AGENTS.md §3. Purchase mechanism undecided — see Appendix B-3.

### US-38 — Export my data

**As a** workspace owner, **I want** to export our transaction rows once paid, **so that** I own a copy of my data before I delete anything.

- **Given** a paid workspace, **When** I trigger export, **Then** I receive the workspace's rows in a machine-readable file with amounts and dates correctly formatted.
- **Given** a free workspace, **When** I attempt export, **Then** it is locked with the same clear unlock message as additional imports (US-35).
- **Given** export, **When** it runs, **Then** it contains only this workspace's data and only after server-side membership verification.

**Source:** BRD §4 FR-12 (export unlocked by paid state), BRD §7 Phase 4 (deletion flow context), ITA §7 ("users can export their rows before deleting"). Format undefined — see Appendix B-1.

---

## 14. Epic E10 — Deletion & Privacy

### US-39 — Delete a workspace

**As a** workspace owner, **I want** to delete our workspace, **so that** our financial history is erased when we are done (or on request).

- **Given** an owner session, **When** I delete the workspace, **Then** all rows (transactions, imports, commitments, categories, memberships) are removed immediately and cascaded — no orphan rows remain queryable.
- **Given** a deleted workspace, **When** backups age out, **Then** the data is purged from backups within 30 days.
- **Given** a non-owner, **When** they attempt workspace deletion, **Then** the action is refused.

**Source:** BRD §4 FR-12 (deletion), BRD §5 NFR-06 (purge ≤ 30 days), BRD §3 In Scope; cascade per ITA §5/§7. Owner-only restriction: Appendix B-6.

### US-40 — Delete my account

**As a** user, **I want** to delete my account, **so that** my personal data is not kept after I leave (Indonesian PDP law).

- **Given** a registered account, **When** I delete it, **Then** my user record and sessions are removed and I can no longer sign in.
- **Given** an account that owns a workspace, **When** it is deleted, **Then** the workspace follows an explicit, stated path (deleted with it, or clearly handed over) — never left silently broken for the other member.
- **Given** a deletion request, **When** it is processed, **Then** the purge completes within the 30-day backup window stated by NFR-06.

**Source:** BRD §3 In Scope ("Account and workspace deletion"), BRD §5 NFR-06. Side-effect semantics undefined — see Appendix B-5.

### US-41 — No statement file, image, or avatar of mine is ever stored

**As a** privacy-conscious member, **I want** a product that stores only normalised rows, **so that** there are no documents to breach, leak, or retain.

- **Given** any import, **When** it completes, **Then** the system holds only derived rows — zero file bytes of the statement persist anywhere.
- **Given** the whole application, **When** routes are inventoried, **Then** no endpoint accepts uploads of documents, images, or avatars, and no object storage is configured.
- **Given** logs and third-party services, **When** an import runs, **Then** no document content or file is forwarded to any of them.

**Source:** BRD §5 NFR-01, BRD §4 FR-03 ("never uploaded, never stored, never logged"), BRD §8 (document storage: none), ITA ADR-08.

### US-42 — My financial details stay out of system logs

**As a** member, **I want** operational logs to carry no amounts or row contents, **so that** routine monitoring can never expose our finances.

- **Given** any request that touches transactions, **When** it is logged, **Then** only route, status, and workspace id are written — never amounts, descriptions, or row contents.
- **Given** an error during an import, **When** details are logged, **Then** the same restriction holds; the user-facing message stays generic.

**Source:** no BRD requirement — derived from ITA §7 / ITA §11 gotcha 9, PEP risk R7, AGENTS.md §8. Flagged as extra-BRD in Appendix A.

---

## 15. Epic E11 — Errors & Resilience

### US-43 — Get an explicit error with retry when the database is unreachable

**As a** member, **I want** a clear failure message with a retry option when the database is down, **so that** I am never misled by a blank or fake-zero dashboard.

- **Given** an unreachable database, **When** I load the dashboard or submit a mutation, **Then** I receive an explicit error with a retry action in Bahasa Indonesia — never a blank screen, never a zeroed-out total that looks like real data.
- **Given** the same failure, **When** the server responds, **Then** it is an explicit 503-class structured error; details go to logs, a generic message to me.
- **Given** a transient failure, **When** I press retry after recovery, **Then** the page loads normally with no manual workaround.

**Source:** BRD §5 NFR-07 (graceful degradation, explicit error, no blank screen); behaviour per ITA §2, AGENTS.md §8.

### US-44 — See exactly which line failed to parse

**As a** member with a malformed file, **I want** the offending line surfaced and nothing half-saved, **so that** I can fix the file without corrupting my ledger.

- **Given** a file that fails parsing (including a no-text-layer PDF), **When** I import it, **Then** the offending line/input is shown in the browser and the reason is explained in Bahasa Indonesia.
- **Given** a parse failure, **When** it happens, **Then** nothing is persisted — no import row, no transactions.
- **Given** a failed attempt, **When** I fix the file and retry, **Then** the import proceeds normally with the full preview flow.

**Source:** BRD §4 FR-03 (validate step); failure behaviour per ITA §2, AGENTS.md §8.

### US-45 — Get a clear message when rate limited

**As a** user hitting a limit, **I want** to be told plainly that I am rate limited and when to retry, **so that** I never see a mysterious dead button.

- **Given** more than 10 auth attempts per minute from one IP, **When** the limit is exceeded, **Then** a clear Bahasa Indonesia message states the limit and retry timing.
- **Given** more than 20 imports per hour in one workspace, **When** the limit is exceeded, **Then** the import screen shows the same style of clear message; existing data is unaffected.
- **Given** a rate-limited request, **When** it is rejected, **Then** the rejection is explicit — never a silent no-op or an unexplained 500.

**Source:** BRD §5 NFR-02 (10/min/IP auth; 20/hour/workspace import), AGENTS.md §9.

### US-46 — Report system health to the operator

**As an** operator, **I want** a health endpoint reporting database status, **so that** outages are detected without waiting for user complaints.

- **Given** the database is reachable, **When** `/api/health` is called, **Then** it reports `db: up`.
- **Given** the database is unreachable, **When** `/api/health` is called, **Then** it reports `db: down` while user-facing routes return the explicit error of US-43.

**Source:** ITA §6 (`/api/health`), PEP §3 M1 exit criteria. Not a BRD requirement — flagged in Appendix A.

---

## 16. Epic E12 — Accessibility, Localisation & Performance

### US-47 — Exact money arithmetic and display

**As a** member, **I want** every amount stored and summed exactly, **so that** reconciliation and totals are never off by rounding.

- **Given** any transaction, budget, or commitment, **When** it is stored, **Then** the amount is an integer in minor units (1/100 rupiah) — no floating point in storage or arithmetic anywhere.
- **Given** a set of transactions, **When** totals are aggregated, **Then** the sum is exact in integer minor units with zero rounding defects in the reconciliation suite.
- **Given** a reconciliation with amounts printed to whole rupiah, **When** it runs, **Then** tolerances are exactly Rp 1 (chain) and Rp 0.05 (totals) — no epsilon drift from float math.

**Source:** BRD §5 NFR-03, BRD §4 FR-04.

### US-48 — Bahasa Indonesia first, IDR and id-ID formatting everywhere

**As an** Indonesian user, **I want** the whole product in Bahasa Indonesia with rupiah and dates in local format, **so that** I read amounts correctly at a glance.

- **Given** any money value, **When** it renders, **Then** it uses `Rp 1.234.567` grouping via the single shared money module — never `$`, never `en-US` grouping, never raw `toString()`.
- **Given** any date, **When** it renders, **Then** it uses `id-ID` format.
- **Given** any user-facing copy (buttons, errors, states), **When** it is written, **Then** it is Bahasa Indonesia and consistent with the BRD's wording, e.g. "Cocok dengan saldo bank", "Impor mutasi".

**Source:** BRD §5 NFR-09; wording per BRD §9, AGENTS.md §6.

### US-49 — Use the whole product with a keyboard and assistive tech (WCAG 2.2 AA)

**As a** keyboard or screen-reader user, **I want** every interactive screen to meet WCAG 2.2 AA, **so that** I can manage our fund without a mouse.

- **Given** any input, **When** it renders, **Then** it has an associated `<label>`; icon-only buttons carry `aria-label`; validation errors are announced via `aria-describedby`/`aria-live`.
- **Given** a form, dialog, or the ledger, **When** I navigate by keyboard only, **Then** the full path is reachable with visible focus rings, dialogs trap focus, and Escape closes them.
- **Given** any text or status colour (including the green "Cocok" badge), **When** contrast is measured, **Then** it meets ≥ 4.5:1; semantic elements (`button`, `table`, heading order) are used rather than div-click handlers.

**Source:** BRD §5 NFR-08; specifics per AGENTS.md §6.

### US-50 — Every screen has loading, empty, error, and success states

**As a** member on a flaky connection, **I want** each screen to always tell me what is happening, **so that** I am never left staring at a blank page.

- **Given** a page fetching data, **When** it loads, **Then** a skeleton loading state (not a spinner over blank space) is shown.
- **Given** a page with no data, **When** it renders, **Then** an empty state explains what to do next.
- **Given** a failed request (including DB-down per US-43), **When** it renders, **Then** an error message with a retry button is shown — the screen never renders nothing.
- **Given** a successful mutation, **When** it completes, **Then** the success state is visible and server state is revalidated (no stale hand-rolled cache).

**Source:** BRD §5 NFR-07 (explicit error, no blank screen); state inventory per AGENTS.md §6.

### US-51 — Fast on a 4G phone

**As a** member checking the fund on mobile data, **I want** the dashboard and import to be quick, **so that** the product beats the spreadsheet it replaces.

- **Given** a one-month statement, **When** I complete an import, **Then** the flow completes within 5 s p95 (parsing is on-device; the server only validates and writes in one batch).
- **Given** the dashboard on a 4G connection, **When** it loads, **Then** it renders within 1.5 s p95.
- **Given** the import page, **When** the app bundle loads, **Then** pdf.js is loaded only on that page (dynamic import), never in the root bundle, and the ledger never renders 5,000 rows at once.

**Source:** BRD §5 NFR-04; bundle/rendering specifics per AGENTS.md §6, ITA §8.

---

## Appendix A — Requirement traceability

| Requirement | Stories |
|---|---|
| BRD FR-01 Account & Session | US-01, US-02, US-03, US-04, US-55 (auth page) |
| BRD FR-02 Workspace & Invite | US-05, US-06, US-07, US-08, US-53 |
| BRD FR-03 Statement Import | US-09, US-10, US-11, US-12, US-13 |
| BRD FR-04 Reconciliation Gate | US-14, US-15, US-16, US-17 |
| BRD FR-05 Ledger | US-18, US-19, US-20, US-21 |
| BRD FR-06 Categories & Rules | US-22, US-23 |
| BRD FR-07 Contribution Attribution | US-24, US-25 |
| BRD FR-08 Budget versus Actual | US-26, US-27 |
| BRD FR-09 Commitments | US-28, US-29, US-30 |
| BRD FR-10 Forecast | US-31 |
| BRD FR-11 Share Report | US-32, US-33, US-34 |
| BRD FR-12 Entitlement & Deletion | US-35, US-37, US-38, US-39, US-40 (price → US-36; landing price claim → US-54) |
| BRD FR-13 Invitation Email (Resend) | US-52, US-53 |
| BRD §3 In Scope (export, account deletion, WO share) | US-38, US-40, US-33 |
| BRD §7 Phase 4 (pricing page, deletion flow) | US-36, US-39, US-40 |
| BRD NFR-01 Privacy / no file storage | US-09, US-41 |
| BRD NFR-02 Security & rate limits | US-02, US-04, US-45, US-52, US-55 (rate-limit error rendering) |
| BRD NFR-03 Money correctness | US-05, US-25, US-47 |
| BRD NFR-04 Performance | US-51, US-54 (landing budget applied by analogy) |
| BRD NFR-05 Portability | *none — engineering constraint, not user-facing* |
| BRD NFR-06 Compliance / deletion | US-39, US-40 |
| BRD NFR-07 Availability / degradation | US-43, US-50, US-56 |
| BRD NFR-08 Accessibility | US-49, US-54, US-55, US-56 |
| BRD NFR-09 Localisation | US-48, US-54, US-55, US-56 |
| BRD NFR-10 Cost | *none — engineering constraint, not user-facing* |
| BRD-derived / scope-inferred — no FR exists (landing page, auth page layout, 404 page) | US-54, US-55 (page layout only), US-56 — see Appendix B-13 / B-14 |
| Extra-BRD (ITA/PEP/AGENTS only) | US-42 (log hygiene), US-46 (health endpoint) |

Excluded features (BRD §3 / AGENTS.md §10) intentionally have **zero** stories — see §3.

## Appendix B — Open questions & cross-document conflicts

Nothing below was silently resolved into a story; each item flags where the docs are thin or diverge.

1. **Export format undefined (B-1).** FR-12 gates "export" behind payment and ITA §7 says users can export before deleting, but no document defines export format, scope, or UI. US-38 deliberately says only "machine-readable file". *Needs a BRD clarification.*
2. **Double-count UX undefined (B-2).** FR-09 says a payment counted twice as a transaction and as commitment `paid` "must be visibly reconciled" — what the UI shows, and whether totals exclude the duplicate until resolved, is unspecified. US-30 states only the guarantee (never silently double-counted, never silently dropped).
3. **Purchase mechanism undecided (B-3).** BRD FR-12 says "one-time purchase" with no provider; ITA §6 says "Lynk.id now, Midtrans later — signed webhook or license code"; PEP M4 allows "license code or Lynk.id order grant" and R5 makes the decision a day-5 risk. US-37 specifies the outcome (idempotent grant, one-time charge) and is provider-neutral. No conflict with the no-subscription exclusion.
4. **Share-link TTL unspecified (B-4).** FR-11 requires "expiring" links but sets no default lifetime. US-32/US-34 cover creation and revocation; the default expiry needs a value.
5. **Account-deletion side effects undefined (B-5).** §3 promises "account and workspace deletion", but FR-12 only specifies *workspace* deletion. What happens when a non-owner member deletes their account, or an owner deletes their account while the workspace has a second member or a paid entitlement, is unspecified (ITA §5 ties retention to workspace deletion). US-40 flags the requirement that the path be explicit rather than inventing one.
6. **Edit paths and owner-only actions inferred (B-6).** FR-02 defines creating `weddingDate`/`budgetTarget` and rotating the invite code, but not editing them later, nor explicitly restricting rotation/deletion to the owner (the two-member cap makes owner-only the natural reading). US-07, US-08, US-39 mark these as interpretations.
7. **Reconciliation confirmation — interpretation applied (B-7).** FR-04 ("confirm before treated as final", "never silently included") and ITA §2 ("excluded from trusted totals until the user confirms") are read together in US-17: excluded until explicit confirmation; after confirmation included *and* still visibly flagged. Consistent, but worth a product-owner nod.
8. **XLSX vs "generic CSV path" (B-8).** §3 In Scope allows "CSV/Excel", FR-03 accepts `.xlsx`, while the out-of-scope list and PEP cut order say "generic CSV path". Read as one generic adapter path covering both (US-10); not treated as a conflict.
9. **No admin role exists (B-9).** The requested "admin/ops" role does not exist in BRD §3 (roles beyond owner/member are excluded). Operator needs are covered by US-46 only, positioned as an out-of-app operator, not an in-app admin.
10. **Not conflicts, just excluded by design:** email verification/receipts are explicitly deferred ("later", ITA §6 — never lock users out while unconfigured) — invitation email (FR-13) is now in scope but is the *only* email v1.0 sends; NFR-05/NFR-10 are non-user-facing; and BRD §2 objectives are metrics measured over these stories.
11. **Invite link / pocket code lifetime unspecified (B-11).** No document defines a TTL for the pocket code or the invite link — the only invalidation path specified is rotation (US-07) — even though an error on an *expired* code was expected. US-06/US-53 therefore cover *invalid, malformed, rotated, already-member* and not *expired*; "expired" is read as an alias for rotated rather than a new expiry feature. If a real TTL is wanted for emailed links, it needs a BRD value first — and it would need a stored invite record with its own expiry, which the current schema does not have (FR-13: "no separate invite record").
12. **Terminology: "pocket code" vs "pocket" (B-12).** BRD reserves *pocket* for a Bank Jago shared pocket inside a statement (FR-03, glossary), while the workspace is the app's joinable unit. The approved requirement names the workspace invite code the **pocket code**; the docs adopt that as user-facing copy (glossary, FR-02, FR-13) and map it explicitly to `workspaces.inviteCode`. Worth a product-owner nod that users will not confuse "join the pocket" with choosing an import pocket.
13. **Landing and 404 pages are scope-inferred (B-13).** BRD §3 In Scope and §4 name no landing page and no not-found page; §7 Phase 4 lists the pricing page, privacy policy, and terms — not a marketing entry page. US-54 and US-56 are written as the minimum public entry point and dead-end handling: US-54 constrains every claim to §1/FR-12 (no invented pricing or features), US-56 covers only the not-found state and defers all data-failure behaviour to US-43. Rationale is inferential — §2 objective 4 (20 paid workspaces at CAC ≤ Rp 60.000) presupposes a public entry point, and NFR-07 forbids blank screens. *Needs a product-owner nod that both pages are v1.0 scope; if either is cut, US-54/US-56 retire and the auth page (US-55) becomes the only front door.*
14. **Auth page layout unspecified (B-14).** FR-01 defines the sign-up/sign-in *endpoints* and US-03 anchors the redirect at `/login`, but no document specifies whether the UI is one page with two modes or two separate routes. US-55 chooses a single `/login` page with a visible mode switch (one story, not two, because the fields, validation, session, and error behaviour are identical in both modes). Revisit only the route split if desired — US-01/US-02 behaviour is untouched either way.
