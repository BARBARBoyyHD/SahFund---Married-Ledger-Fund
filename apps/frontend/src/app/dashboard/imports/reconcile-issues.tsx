import type { ReconcileIssue, ReconcileIssueKind } from "@/core/reconcile";

/**
 * The one renderer for reconciliation issues (AGENTS §7): the preview and the flagged
 * import list both show the message `core/reconcile.ts` produced, never a re-worded copy.
 * Server-safe, so the page and the client leaf share it.
 */

export const ISSUE_LABEL: Record<ReconcileIssueKind, string> = {
  balance_chain: "Rantai saldo",
  totals: "Total masuk/keluar",
  opening: "Saldo awal",
  duplicate: "Duplikat di file",
  empty: "Kosong",
};

export function IssueList({ issues }: { issues: ReconcileIssue[] }) {
  return (
    <ul className="mt-2 space-y-2 text-small text-ink">
      {issues.map((issue, index) => (
        <li key={`${issue.kind}-${index}`}>
          <span className="font-semibold">{ISSUE_LABEL[issue.kind]}:</span> {issue.message}
          {issue.line ? <span className="text-ink-muted"> (baris {issue.line})</span> : null}
          {issue.raw ? (
            <code className="mt-1 block overflow-x-auto rounded-xs bg-surface px-3 py-2 text-ink">
              {issue.raw}
            </code>
          ) : null}
        </li>
      ))}
    </ul>
  );
}
