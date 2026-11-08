## ADDED Requirements

### Requirement: Seeded Indonesian wedding category set
Every new workspace SHALL be seeded with exactly: Catering, Venue, Dekorasi, Busana & Rias, Dokumentasi, Undangan & Souvenir, Seserahan & Mahar, Adat & Prosesi, Transportasi, Lain-lain. Category names SHALL remain unique within the workspace — a duplicate name on rename or create SHALL be rejected with a clear message (database-enforced).

#### Scenario: New workspace starts seeded
- **WHEN** a workspace is created
- **THEN** the seeded set of ten Indonesian wedding categories exists in it

#### Scenario: Duplicate name rejected
- **WHEN** a user renames or adds a category with a name already in the workspace
- **THEN** it is rejected with a clear message — no duplicate name is stored

### Requirement: Corrections become payee-to-category rules
Accepting an offered correction SHALL create a payee→category rule that auto-categorises matching transactions in **future imports only** — re-importing a past statement SHALL NOT rewrite already-stored rows. Deleting a rule SHALL stop it applying to future imports while leaving existing rows untouched. Rules SHALL apply only to newly imported rows.

#### Scenario: Accepted rule auto-categorises future imports
- **WHEN** a user accepts a category correction as a rule and a later import contains the same payee
- **THEN** those newly imported transactions are auto-categorised

#### Scenario: Stored rows are never rewritten
- **WHEN** a rule is created or deleted while re-importing a past statement
- **THEN** already-stored rows are not retroactively changed

#### Scenario: Deleting a rule stops future application
- **WHEN** a user deletes a rule
- **THEN** future imports no longer apply it and existing rows are untouched
