import Link from "next/link";

import { AuthForm } from "@/app/login/auth-form";
import { type Mode } from "@/app/login/auth-form";

const COPY = {
  "sign-up": { tab: "Buat akun", href: "/login" },
  "sign-in": { tab: "Masuk", href: "/login?mode=masuk" },
} as const;

const MODES: Mode[] = ["sign-up", "sign-in"];

/** Reads the mode from the URL (shareable, back-button correct), so it streams inside Suspense. */
export async function LoginPanel({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  const mode: Mode = params.mode === "masuk" ? "sign-in" : "sign-up";
  // US-53: the join link's `next` survives the sign-in detour; the server re-validates it.
  const next = typeof params.next === "string" ? params.next : undefined;

  /** Keep `next` when the visitor switches back to sign-in (sign-up ignores it). */
  const tabHref = (item: Mode) =>
    item === "sign-in" && next
      ? `/login?mode=masuk&next=${encodeURIComponent(next)}`
      : COPY[item].href;

  return (
    <>
      <nav
        aria-label="Pilih mode"
        className="grid grid-cols-2 gap-1 rounded-sm border border-gold/40 bg-pearl p-1"
      >
        {MODES.map((item) => {
          const active = item === mode;
          return (
            <Link
              key={item}
              href={tabHref(item)}
              scroll={false}
              aria-current={active ? "page" : undefined}
              className={`flex h-10 items-center justify-center rounded-xs text-small font-bold transition-colors duration-150 ${
                active
                  ? "bg-emerald text-pearl"
                  : "text-ink-muted hover:text-emerald"
              }`}
            >
              {COPY[item].tab}
            </Link>
          );
        })}
      </nav>

      <AuthForm key={mode} mode={mode} next={next} />
    </>
  );
}
