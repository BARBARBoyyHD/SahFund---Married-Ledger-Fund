# invite-email — delta spec for change `auth-workspace-invite`

## ADDED Requirements

### Requirement: Sending a pocket invite by email
**Source**: BRD §4 FR-13, FR-02, BRD §5 NFR-02 and NFR-01; USER-STORIES US-52
The system SHALL let the workspace owner submit a partner's email address to send an invite through Resend containing the pocket code and a join link as a text-only Bahasa Indonesia message with no attachments and no financial data, SHALL answer `sent` when Resend accepts the message and `fallback` — with the invite unaffected — on any send failure, and SHALL refuse sends beyond 10 per workspace per hour.

#### Scenario: Successful send
- **WHEN** the owner submits a valid email address on the invite screen and Resend accepts the message
- **THEN** an email containing the pocket code and join link is sent as text-only Bahasa Indonesia with no attachments and no financial data, and the screen confirms it was sent

#### Scenario: Send failure falls back to manual sharing
- **WHEN** the send fails because of a Resend error, a missing `RESEND_API_KEY`, or a network failure
- **THEN** the response reports `fallback`, the invite code and link remain valid, and the screen shows the pocket code and join link for manual copying plus a retry button — never a dead button and never a swallowed error

#### Scenario: Rate limit of ten sends per hour per workspace
- **WHEN** more than 10 invite sends are attempted for one workspace within one hour
- **THEN** the send is refused with the same clear Bahasa Indonesia rate-limit message style used for auth limits and existing membership is unaffected

#### Scenario: Denied attempts do not inflate the counter
- **WHEN** a send is refused because the workspace limit was already reached
- **THEN** that workspace's counter for the current window is not incremented

#### Scenario: No credentials in logs
- **WHEN** any invite attempt is processed, succeeds, or fails
- **THEN** neither the pocket code nor the recipient's email address appears in any log output

### Requirement: Joining from the invite email link
**Source**: BRD §4 FR-02, FR-13, BRD §5 NFR-01; USER-STORIES US-53
The system SHALL provide a join link that carries the pocket code so an invited partner who signs in reaches a single confirmation whose submit creates the membership through the same code path as manual entry, with the pocket code alone remaining the credential for both paths.

#### Scenario: Link with sign-in pre-fills the code
- **WHEN** an invited partner opens the join link and signs in
- **THEN** the pocket code is pre-filled and one confirmation creates the membership and shows the shared dashboard

#### Scenario: Manually shared code or link works identically
- **WHEN** a partner whose invite email failed receives the pocket code or join link out of band and uses it
- **THEN** they join exactly as with the emailed link, because the code alone is the credential

#### Scenario: Rotated code from an older email
- **WHEN** a join link or code from an email that predates a rotation is submitted
- **THEN** the clear "code not valid" message of the manual join path is shown — never an error dump or a broken screen

#### Scenario: Full workspace via the link
- **WHEN** the join link is confirmed for a workspace that already has two members
- **THEN** the join is refused with the clear full-workspace message, enforced by the database (`UNIQUE (members.workspaceId, role)`)

#### Scenario: Already belongs to another workspace via the link
- **WHEN** a user who already belongs to a workspace confirms a join link for a different workspace
- **THEN** the join is refused with the clear "you already belong to a workspace" message and no second membership row is created

#### Scenario: Email content limits
- **WHEN** the invite email is rendered for sending
- **THEN** it carries only the pocket code, the join link and explanatory copy in Bahasa Indonesia, with no financial data and no attachment of any kind
