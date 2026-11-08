"use client";

import { BUTTON_SMALL } from "@/components/app/ui";
import { useSignOut } from "@/components/app/use-sign-out";

/**
 * US-03: sign-out clears the session server-side (`/api/auth/sign-out` relays Better
 * Auth's cleared cookie) and lands on `/login`. A failure is shown verbatim — the
 * button stays live, so it is also the retry.
 */
export function SignOutButton() {
  const { signOut, pending, message } = useSignOut();

  return (
    <div className="flex flex-wrap items-center justify-end gap-2">
      {message ? (
        <p role="alert" className="text-small font-semibold text-danger">
          {message}
        </p>
      ) : null}
      <button type="button" onClick={signOut} disabled={pending} className={BUTTON_SMALL}>
        {pending ? "Keluar…" : "Keluar"}
      </button>
    </div>
  );
}
