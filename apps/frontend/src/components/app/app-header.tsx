import type { ReactNode } from "react";
import Link from "next/link";

import { Container } from "@/components/landing/ui";
import { Wordmark } from "@/components/mark";

/** The signed-in chrome: wordmark home, who is signed in, one action (sign out / sign in). */
export function AppHeader({
  userName,
  action,
  homeHref = "/dashboard",
}: {
  userName?: string;
  action?: ReactNode;
  homeHref?: string;
}) {
  return (
    <header className="border-b border-gold/40 bg-surface">
      <Container className="flex min-h-16 flex-wrap items-center justify-between gap-3 py-2">
        <Link href={homeHref} className="rounded-xs">
          <Wordmark />
        </Link>
        <div className="flex items-center gap-3">
          {userName ? (
            <p className="hidden max-w-[28ch] truncate text-small text-ink-muted sm:block">
              {userName}
            </p>
          ) : null}
          {action}
        </div>
      </Container>
    </header>
  );
}
