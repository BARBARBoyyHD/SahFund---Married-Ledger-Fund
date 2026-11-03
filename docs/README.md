# SahFund — Documentation Index

Open the `docs/` folder as an Obsidian vault to browse and link these documents.
All links are plain relative markdown, so they work in Obsidian **and** on GitHub.

## Sources of truth (in order)

1. **[ITA — Implementation & Technical Architecture](projects/ITA.md)** — stack, system/data architecture, ADRs, implementation guidance. Cited as `ITA §N`.
2. **[BRD — Business Requirements Document](projects/BRD.md)** — scope, functional and non-functional requirements. Cited as `BRD §N`.
3. **[PEP — Project Execution Plan](projects/PEP.md)** — milestones, work breakdown, risks, quality and release gates. Cited as `PEP §N`.

Reading order: BRD defines *what*, ITA defines *how*, PEP defines *when*.
If code and docs disagree, stop and ask — do not silently pick a side.

> **Citation rule:** `BRD §3` means the heading `## 3. Scope` in that file.
> Section numbers in ITA/BRD/PEP are stable cross-document anchors — do not
> renumber or rename headings there. Navigation aids belong in this index.

## UI

- **[DESIGN.md](ui/DESIGN.md)** — design tokens and UI guidance: colors, typography, layout, components, do's and don'ts.

## Other files

- [ui/lint.json](ui/lint.json) — lint rules for the UI (tool config, not a note; enable "Detect all file extensions" in Obsidian to see it).
- [ui/html/design.html](ui/html/design.html) — static design preview.
