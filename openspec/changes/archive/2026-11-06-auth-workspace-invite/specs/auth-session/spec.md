# auth-session — delta spec for change `auth-workspace-invite`

## ADDED Requirements

### Requirement: Account creation (sign-up)
**Source**: BRD §4 FR-01; USER-STORIES US-01
The system SHALL create an account from name, email and password (minimum 10 characters) validated by one shared Zod schema, establish a session cookie with the attributes required by AGENTS §9, and direct the new user to workspace creation.

#### Scenario: Successful sign-up
- **WHEN** a visitor submits a unique email, a name and a password of at least 10 characters on the sign-up form
- **THEN** the account is created, `name` is stored as the display name, a session cookie is set (httpOnly, Secure in production, SameSite=Lax), and the browser is directed to workspace creation

#### Scenario: Rejected sign-up leaves no account
- **WHEN** a visitor submits a password shorter than 10 characters or an email that already exists
- **THEN** no account is created, no session is established, and an inline field error in Bahasa Indonesia explains the problem

#### Scenario: Display name is stored for attribution
- **WHEN** an account is created
- **THEN** the name is persisted on the user row as the display name that attribution views render (ledger epic)

### Requirement: Sign-in
**Source**: BRD §4 FR-01, BRD §5 NFR-02; USER-STORIES US-02
The system SHALL authenticate a registered account with email and password, set the session cookie on success, redirect to the dashboard, and answer unknown email and wrong password with a single generic Bahasa Indonesia error that reveals no account-enumeration detail.

#### Scenario: Successful sign-in
- **WHEN** a registered user submits correct credentials
- **THEN** a session cookie is set and the browser is redirected to the dashboard

#### Scenario: Repeated attempts from one IP are rate limited
- **WHEN** more than 10 sign-in attempts per minute arrive from the same IP address
- **THEN** further attempts are refused with a clear Bahasa Indonesia rate-limit message and no account-enumeration detail

#### Scenario: Invalid credentials are indistinguishable
- **WHEN** an unknown email or a wrong password is submitted
- **THEN** one generic error is shown to the user while the details go only to server logs

### Requirement: Sign-out
**Source**: BRD §4 FR-01; USER-STORIES US-03
The system SHALL clear the session cookie when an authenticated user signs out, and SHALL redirect unauthenticated requests for the dashboard to `/login` without rendering any workspace data.

#### Scenario: Signing out clears the session
- **WHEN** a signed-in user activates the sign-out control
- **THEN** the session cookie is cleared and the browser lands on the login page

#### Scenario: Dashboard without a session
- **WHEN** an unauthenticated request reaches the dashboard
- **THEN** it is redirected to `/login` server-side and no workspace data is rendered

### Requirement: Server-side session and membership enforcement
**Source**: BRD §4 FR-01, BRD §5 NFR-02; ITA §7 / ADR-11; USER-STORIES US-04
Every protected page and route handler SHALL validate the session server-side and verify workspace membership for the requested workspace before returning any row, and any edge redirect SHALL be convenience only, never the authorization boundary.

#### Scenario: Unauthenticated request to a protected route
- **WHEN** a request without a valid session reaches a protected page or route handler
- **THEN** it is rejected or redirected server-side and no data is returned

#### Scenario: Signed-in non-member requests another workspace's data
- **WHEN** a signed-in user who is not a member of workspace W requests W's data by URL id or API
- **THEN** the request is denied with no row from W returned and the response does not disclose whether W exists

#### Scenario: Expired or forged session cookie
- **WHEN** a request presents an expired or forged session cookie
- **THEN** it is treated as unauthenticated

#### Scenario: Edge redirect is not the boundary
- **WHEN** a request passes the edge redirect while carrying an expired or forged cookie
- **THEN** the server-side validation still denies access
