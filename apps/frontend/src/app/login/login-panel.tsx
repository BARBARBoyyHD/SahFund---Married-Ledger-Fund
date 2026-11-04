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

  return (
    <>
      <nav
        aria-label="Pilih mode"
        className="mt-7 grid grid-cols-2 gap-1 rounded-sm bg-neutral p-1"
      >
        {MODES.map((item) => {
          const active = item === mode;
          return (
            <Link
              key={item}
              href={COPY[item].href}
              scroll={false}
              aria-current={active ? "page" : undefined}
              className={`flex h-10 items-center justify-center rounded-xs text-small font-bold transition-colors duration-150 ${
                active
                  ? "bg-surface text-primary"
                  : "text-muted hover:text-tertiary"
              }`}
            >
              {COPY[item].tab}
            </Link>
          );
        })}
      </nav>

      <AuthForm key={mode} mode={mode} />
    </>
  );
}
