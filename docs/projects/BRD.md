# Business Requirements Document — SahFund

**Version:** 0.1
**Date:** 2026-Nov-02
**Status:** Draft

---

## 1. Executive Summary

SahFund is a two-person workspace for engaged couples in Indonesia: it imports the shared bank pocket statement (Bank Jago, or a CSV export from another bank), reconciles it against the balance the bank itself prints, categorises where the money went, and forecasts whether the wedding is funded by its date. It replaces the spreadsheet and the "we think we're fine" conversation with one report both partners can read. It is sold once per wedding, not as a subscription, because the job ends on the wedding day.

---

## 2. Business Objectives

| # | Objective | Success Metric |
|---|-----------|----------------|
| 1 | Replace manual bookkeeping | ≥ 80% of transactions come from an import rather than manual entry, measured per workspace by month 3 |
| 2 | Make the numbers trustworthy | 100% of imports either reconcile to the bank's closing balance or are explicitly flagged; ≤ 2% of support contacts are "the total is wrong" |
| 3 | Answer the only question that matters | ≥ 60% of active workspaces open the forecast within 30 days of their wedding date |
| 4 | Prove willingness to pay | 20 paid workspaces within 60 days of launch, at CAC ≤ Rp 60.000 |
| 5 | Keep operations near zero | ≤ 30 minutes of support per week per 100 active workspaces |

---

## 3. Scope

### In Scope

- Account creation and sign-in (email + password), one owner per workspace, one workspace per user
- Invite a second member by email (sent via Resend) or by sharing the pocket code; both see the same fund
- Import a Bank Jago statement (PDF text layer, processed on the user's device)
- Import a CSV/Excel statement from any other bank via column mapping
- Reconciliation gate: opening + money in − money out must equal the printed closing balance
- Ledger: list, filter, search, re-categorise, manual entry for cash
- Categories with per-category budgets, seeded with an Indonesian wedding set
- Attribution: which partner contributed or spent
- Commitments: vendor, contract value, DP paid, due date, pelunasan
- Forecast: funded or shortfall amount at the wedding date, plus required monthly saving
- Read-only share link for family or a wedding organizer
- One-time purchase entitlement
- Account and workspace deletion

### Out of Scope (v1.0)

- Subscription or recurring billing of any kind
- OCR for scanned/photographed statements, screenshot capture, Android notification capture
- Banks beyond Jago plus the generic CSV path
- Digital invitation, guest list, RSVP, seating chart
- Vendor marketplace, vendor directory, or vendor payments
- Multi-currency
- Any storage of uploaded documents, images, or avatars
- LLM-based categorisation
- Native mobile applications
- Wedding-organizer multi-client mode
- Roles beyond owner and member

---

## 4. Functional Requirements

### FR-01: Account and Session

```
POST /api/auth/sign-up/email   { name, email, password }
POST /api/auth/sign-in/email   { email, password }
GET  /dashboard                -> 302 /login when no session
POST /api/auth/sign-out        -> clears session cookie
```

| Field | Required | Default | Description |
|-------|----------|---------|-------------|
| name | yes | — | Displayed as the contributor name |
| email | yes | — | Unique identifier |
| password | yes | — | Minimum 10 characters |

Session must be validated server-side on every protected page and route handler; a redirect at the edge is convenience only and never the authorization boundary.

### FR-02: Workspace and Invite

```
POST /workspaces            { name, weddingDate?, budgetTarget? } -> { id, inviteCode }
POST /join                  { inviteCode } -> membership
GET  /w/:workspaceId        -> dashboard
```

| Field | Required | Default | Description |
|-------|----------|---------|-------------|
| name | yes | — | e.g. "Nikah Ayu & Budi" |
| weddingDate | no | null | Drives the forecast; dashboard prompts until set |
| budgetTarget | no | null | Total fund target, IDR |
| inviteCode | auto | 10 chars | The **pocket code** — the join credential for the workspace. Format: 4 digits + 3 letters + 3 alphanumeric, e.g. `4821kPz7xQ`. Unique per workspace; shareable; rotatable by the owner |

v1 hard limit: two members per workspace. A third attempt returns a clear message, not a silent failure.

**One workspace per user.** A user belongs to exactly one workspace — one membership in total. They can neither create a second workspace while already owning one nor join a second workspace while already a member anywhere. Both this rule and the two-member cap are enforced by the database (ITA §5, ERD §5), not merely by handler checks: the constraints absorb concurrent attempts, and the handler translates a violated constraint into the clear message. A user who already belongs to a workspace and attempts either action gets a clear refusal, never a silent failure and never a second membership row.

A partner joins either by entering the pocket code directly or by opening the link in the invite email (FR-13). Both paths are the same credential and hit the same two-member cap and the same one-workspace-per-user rule.

### FR-03: Statement Import

```
CLIENT  file (.pdf | .csv | .xlsx)
        -> pdf.js text extraction (in the browser)
        -> adapter: canParse() -> parse() -> Statement
        -> rows[]

SERVER  POST /w/:id/imports
        { sourceId, period, pocketName, rows[], reconciliation }
        -> validate -> dedupe -> persist -> respond

The document itself is never uploaded, never stored, never logged.
```

| Field | Required | Default | Description |
|-------|----------|---------|-------------|
| file | yes | — | Read locally; only derived rows leave the device |
| pocket | yes | — | A statement may contain several pockets |
| period | no | from document | e.g. "April 2026" |
| rows | yes | — | Maximum 5,000 per import |

### FR-04: Reconciliation Gate

```
reconcile(statement) -> { ok: boolean, issues: [{ kind, message }] }

kind ∈ { balance_chain, totals, opening, duplicate, empty }
chain tolerance   : Rp 1 (statement balances are printed to whole rupiah)
totals tolerance  : Rp 0.05
```

The UI shows a green "Cocok dengan saldo bank" state only when `ok` is true. Otherwise it lists the issues and asks the user to confirm before the data is treated as final. Data from a failed import is never silently included in reports.

### FR-05: Ledger

```
GET   /w/:id/transactions?from&to&category&member&direction&q
PATCH /w/:id/transactions/:txId   { categoryId?, memberId? }
POST  /w/:id/transactions         (manual, for cash and other-bank payments)
```

| Field | Required | Default | Description |
|-------|----------|---------|-------------|
| occurredOn | yes | — | Date of the transaction |
| description | yes | — | From the statement or typed |
| amount | yes | — | Signed; positive = money in |
| categoryId | no | null | Uncategorised until assigned |
| memberId | no | null | Who contributed or spent |
| source | auto | import | `import` or `manual` |

### FR-06: Categories and Rules

Seeded set: Catering, Venue, Dekorasi, Busana & Rias, Dokumentasi, Undangan & Souvenir, Seserahan & Mahar, Adat & Prosesi, Transportasi, Lain-lain.

A payee-to-category rule may be created from any transaction and is applied on future imports. When the user corrects a category, the correction is offered as a rule for the next import of the same payee.

### FR-07: Contribution Attribution

A bulk action assigns a member to many rows at once ("these 12 deposits are Ayu's"). The report shows money in per member, money out per member, and the net position of each.

### FR-08: Budget versus Actual

Per category: budget, committed (signed contracts), paid, remaining. A totals row shows the same four numbers for the whole wedding. Over-budget categories are marked, not hidden.

### FR-09: Commitments

```
POST /w/:id/commitments { vendor, categoryId?, total, paid, dueOn? }
```

A vendor contract exists independently of the transactions that pay it. The dashboard lists the next due dates, and a payment counted twice — once as a transaction and once as `paid` — must be visibly reconciled.

### FR-10: Forecast

```
forecast(balance, committedUnpaid, remainingBudget, weddingDate, plannedMonthlyDeposit)
  -> { status: 'funded' | 'shortfall', shortfallAmount, requiredMonthlyDeposit }
```

Output is one sentence and one number: how much is still needed, and how much to set aside each month to reach the date.

### FR-11: Share Report

```
POST /w/:id/share  -> { token, url, expiresAt }
GET  /r/:token     -> read-only report, no authentication
```

Read-only, expiring, revocable. Shows totals, category breakdown, and forecast. Transaction-level descriptions are excluded by default.

### FR-12: Entitlement and Deletion

- Free state: one import, dashboard visible, export and additional imports locked.
- Paid state: one-time purchase unlocks unlimited imports and export for that workspace.
- Price: Rp 49.000 introductory, Rp 99.000 list. Charge once per wedding.
- Deletion: an owner can delete a workspace; rows are removed immediately and purged from backups within 30 days.

### FR-13: Invitation Email (Resend)

```
POST /w/:id/invite     { email } -> { status: 'sent' | 'fallback' }
```

| Field | Required | Default | Description |
|-------|----------|---------|-------------|
| email | yes | — | The invitee's address; text-only email, no attachments |
| status | auto | — | `sent` when Resend accepted the message; `fallback` when it did not and the UI must offer the manual path |

- Invitations are sent through **Resend** (getresend.com). v1.0 email scope is **invitations only** — no welcome email, no share-report email, no notifications.
- The email contains the pocket code (FR-02) and a join link, in Bahasa Indonesia. It contains no financial data and never carries a document or image (NFR-01).
- The invite itself is the workspace's existing pocket code — there is no separate invite record. Any database write that accompanies the send (e.g. rotating the code first) is committed in a single `db.batch()` **before** the email is attempted; the email is a side effect after the write, never inside it.
- **Email failure does not invalidate the invite.** When the send fails, the invite code and link remain valid, the response is `fallback`, and the UI shows the pocket code and join link for manual copying plus a retry button. Both fallback and retry are required — the owner is never left with a dead button and no way to share.
- Invite sending is rate limited per workspace (NFR-02).
- The pocket code and the recipient address are credentials: never written to logs (NFR-02).

---

## 5. Non-Functional Requirements

| # | Requirement | Target |
|---|-------------|--------|
| NFR-01 | Privacy: no statement document, image, or avatar is ever stored | Zero file bytes persisted; only normalised rows |
| NFR-02 | Security: sessions validated server-side on every protected route; auth rate limited | 10 attempts/minute/IP; import 20/hour/workspace; invite email 10/hour/workspace |
| NFR-03 | Correctness: money as integer minor units; no floating point in storage or arithmetic | 0 rounding defects in the reconciliation suite |
| NFR-04 | Performance: import of a one-month statement; dashboard render on 4G | ≤ 5 s p95; ≤ 1.5 s p95 |
| NFR-05 | Portability: data is standard SQLite (plain SQL, exported with `wrangler d1 export`); access goes through Drizzle with the dialect confined to one schema file and one client module — the Cloudflare-specific part is the `env.DB` binding, not the data | Migration off the host ≤ 2 engineering days (swap = dialect import + client import + regenerate migrations) |
| NFR-06 | Compliance: Indonesian PDP law; data deletion honoured | Delete on request; purge ≤ 30 days |
| NFR-07 | Availability: graceful degradation when the database is unreachable | 99.5% monthly; explicit error, no blank screen |
| NFR-08 | Accessibility: forms, contrast, keyboard navigation | WCAG 2.2 AA for all interactive screens |
| NFR-09 | Localisation: Bahasa Indonesia first, IDR formatting | `Rp 1.234.567` everywhere; `id-ID` dates |
| NFR-10 | Cost: infrastructure at early scale | ≤ US$20/month at 1,000 workspaces |

---

## 6. Architecture (informal)

```
        ┌──────────────────────────────┐
        │ Browser                      │
        │  pdf.js: file -> text        │
        │  adapter: text -> Statement  │
        │  (document never leaves)     │
        └──────────────┬───────────────┘
                       │ rows + reconciliation (JSON only)
                       ▼
        ┌──────────────────────────────┐
        │ App (Next.js on Workers)     │
        │  auth · workspaces · imports │
        │  categories · budget · share │
        └──────────────┬───────────────┘
                       │ binding (env.DB)
                       ▼
        ┌──────────────────────────────┐
        │ Cloudflare D1 (SQLite)       │
        └──────────────────────────────┘
```

The one interface every bank adapter must satisfy:

```
StatementSource
  canParse(input) : boolean
  parse(input)    : Statement
```

Nothing downstream — ledger, budget, forecast, report — knows which bank produced a statement. Adding a bank is a new adapter plus fixtures, not a change to the product.

Full stack, data model, and deployment detail belong in the ITA.

---

## 7. Implementation Phases (indicative)

### Phase 1 — Foundation ⬜
- Accounts, workspace creation, pocket code + invite email (Resend), protected routes, deployment pipeline

### Phase 2 — Import (highest technical risk) ⬜
- Jago adapter, generic CSV adapter, client-side extraction, reconciliation, deduplication

### Phase 3 — Reporting ⬜
- Ledger, categories and rules, attribution, budget versus actual, commitments, forecast, share link

### Phase 4 — Monetisation and hardening ⬜
- One-time entitlement, pricing page, rate limits, error tracking, privacy policy and terms, deletion flow

Indicative duration: one week of focused work, only if §3's out-of-scope list is not renegotiated.

---

## 8. Key Design Decisions

| Decision | Choice | Rationale |
|----------|--------|-----------|
| Billing model | One-time Rp 49.000 / Rp 99.000 per wedding | The Indonesian market has converged on one-time pricing (free to Rp 149.000); a 9-month journey at Rp 20.000/month costs the customer Rp 180.000, more than every one-time competitor |
| Statement extraction | Deterministic parser, no LLM | A wrong digit is unacceptable in a money product; a parser is exact, testable, free per document, and keeps the data off third-party models |
| Where parsing runs | In the browser | The document never leaves the device: no file storage, no retention liability, no upload endpoint to secure |
| Bank coverage | Jago plus generic CSV at launch | One bank done properly beats five done badly; CSV covers "some other bank" cheaply |
| Document storage | None | Removes an entire class of security and privacy obligations, and matches the client-side parsing decision |
| Money representation | Integer minor units | Floating point cannot be trusted with balances, and reconciliation depends on exactness |
| Import cadence | Monthly, stated openly | Neither bank offers an API; the honest product is month-end reconciliation and forecast, not a live balance |
| Authentication | Email + password with server sessions | No dependency on a third-party identity provider for the MVP |
| Workspace membership | Invite code, two members, one workspace per user | Matches the real unit of the product: one couple, one fund — a user has at most one couple to belong to |
| Invitation delivery | Resend email + shareable pocket code | v1.0 sends invitations only, so a plain HTTP API with a free tier beats an SMTP setup; the pocket code stays a working fallback when the email fails, and no document ever rides along |

Market evidence behind these decisions: `brainstorms/2026-11-wedding-planner-market-validation.md`.

---

## 9. Examples / Wireframes

### Import screen

```
┌──────────────────────────────────────────────────────────┐
│ Impor mutasi                              April 2026     │
├──────────────────────────────────────────────────────────┤
│ [ Pilih file e-statement ]   PDF atau CSV                │
│                                                          │
│ Kantong:  ( ) Utama   (•) Kantong Nikah                  │
│                                                          │
│ ┌──────────────────────────────────────────────────────┐ │
│ │ ✓ Cocok dengan saldo bank                            │ │
│ │   Saldo awal   Rp  2.500.000                         │ │
│ │   Masuk        Rp 12.000.000                         │ │
│ │   Keluar       Rp  9.200.000                         │ │
│ │   Saldo akhir  Rp  5.300.000                         │ │
│ └──────────────────────────────────────────────────────┘ │
│                                                          │
│ 34 transaksi baru · 0 duplikat                           │
│                                    [ Impor 34 transaksi ]│
└──────────────────────────────────────────────────────────┘
```

### Report summary

```
Dana terkumpul        Rp 14.500.000   dari target Rp 60.000.000
Sudah terpakai        Rp  9.200.000
Komitmen belum bayar  Rp 21.000.000
────────────────────────────────────────────────────────────
Perkiraan kurang      Rp  5.700.000
Perlu disisihkan      Rp  1.425.000 / bulan  (4 bulan lagi)

Kategori                    Anggaran      Terpakai   Sisa
Catering                 Rp 20.000.000   Rp 12.000.000   ok
Venue                    Rp 15.000.000   Rp 15.500.000   +500.000
Dekorasi                 Rp  8.000.000           0       ok
```

### Reconciliation failure

```
┌──────────────────────────────────────────────────────────┐
│ ! Angka belum cocok                                      │
│   Saldo awal + masuk − keluar = Rp 5.300.000             │
│   Saldo akhir di statement   = Rp 5.312.000              │
│                                                          │
│   13 Apr 2026 11:55  saldo seharusnya Rp 210, tertulis   │
│   Rp 226                                                 │
│                                                          │
│   Periksa kembali file, atau lanjutkan dengan tanda      │
│   "belum cocok" pada laporan.            [ Batal ]       │
└──────────────────────────────────────────────────────────┘
```

---

## 10. Glossary

| Term | Definition |
|------|------------|
| Kantong Bersama | Bank Jago shared pocket: one account balance with more than one member and per-member transaction rights |
| Pocket code | SahFund's name for the workspace invite code: 10 characters, 4 digits + 3 letters + 3 alphanumeric (e.g. `4821kPz7xQ`); the credential used to join a workspace ("join the pocket") |
| e-Statement | The monthly PDF statement a bank generates per pocket or account |
| Mutasi | Transaction history on a bank statement |
| DP | Down payment to a vendor, typically 30–50% of the contract |
| Pelunasan | Settlement of the remaining balance before the event |
| Reconciliation | Proving the imported rows against the balance the bank printed |
| Minor unit | One hundredth of a rupiah; the storage unit for money so integers can be used |
| Adapter | A module that turns one bank's document into the canonical statement model |
| StatementSource | The interface every adapter implements: `canParse` and `parse` |
| WO | Wedding organizer — commonly the party who runs the budget day to day |
| UU PDP | Indonesia's personal data protection law (Law 27/2022) |
