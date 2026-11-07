## ADDED Requirements

### Requirement: Landing page explains SahFund and leads to sign-up
The site root SHALL render a public, unauthenticated landing page in Bahasa Indonesia that explains SahFund as a two-person wedding-fund tracker for Indonesian couples (import bank statement → reconcile against printed balance → see forecast) and offers exactly one primary call to action leading to the sign-up mode of the auth page (`/login`). The page SHALL require no session, no workspace data, and no client-side data fetching.

#### Scenario: Explains the product in Bahasa Indonesia
- **WHEN** an unauthenticated visitor loads the site root
- **THEN** the page explains SahFund in Bahasa Indonesia and presents one primary CTA that navigates to the auth page in sign-up mode

#### Scenario: No session or client fetch required
- **WHEN** the landing page renders with no session cookie and the network tab is inspected
- **THEN** no workspace data is requested and no client-side data fetching occurs

#### Scenario: Mobile-first without horizontal scroll
- **WHEN** the page is viewed on a phone-width viewport over 4G
- **THEN** it renders within the NFR-04 budget applied by analogy (≤ 1.5 s p95) with no desktop-only content and no horizontal scrolling

### Requirement: Landing price claim matches FR-12
Any price or entitlement claim on the landing page SHALL match BRD FR-12 exactly: one-time charge per wedding, Rp 49.000 introductory / Rp 99.000 list price, with no subscription or recurring language and no feature, guarantee, or bank-partnership claims beyond BRD §1/§3.

#### Scenario: Correct one-time price wording
- **WHEN** the pricing section renders
- **THEN** it shows Rp 49.000 introductory and Rp 99.000 list as a one-time charge per wedding, with no subscription or recurring language

#### Scenario: Money figures use the shared format
- **WHEN** any rupiah figure renders on the page
- **THEN** it uses the shared money module in `Rp 1.234.567` form — never `$`, never `en-US` grouping

### Requirement: Landing page meets accessibility bar
The landing page SHALL meet WCAG 2.2 AA: labelled controls, text contrast ≥ 4.5:1, correct heading order, and a visible focus path reaching the primary CTA by keyboard alone.

#### Scenario: Keyboard path to CTA
- **WHEN** a user navigates the page with keyboard only
- **THEN** focus is always visible and reaches the primary call to action

### Requirement: 404 page in Bahasa Indonesia with a way back
Any unknown or malformed URL, requested signed-in or signed out, SHALL render a Bahasa Indonesia not-found page — never a framework default page, never a blank screen, never a stack trace — offering a link back to the landing page and, without performing any data fetch, a path to sign in/dashboard. The 404 state SHALL be distinct from the database-error state (NFR-07) and from any 500-style message.

#### Scenario: Unknown URL renders the 404 screen
- **WHEN** any unknown or malformed URL is requested
- **THEN** the not-found route renders a Bahasa Indonesia "page not found" message with a working link back to the landing page

#### Scenario: 404 is not the database-error state
- **WHEN** a missing route and a failed-database request are compared
- **THEN** they render as two distinct screens — the missing route shows the 404 content, not the database-error/retry UI

#### Scenario: Accessible and keyboard reachable
- **WHEN** the 404 page is inspected for WCAG 2.2 AA
- **THEN** copy is Bahasa Indonesia, heading order and link focus are correct, contrast is ≥ 4.5:1, and the way-back link is reachable by keyboard alone
