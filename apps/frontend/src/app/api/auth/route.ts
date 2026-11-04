import { NextResponse } from "next/server";

import {
  fieldErrors,
  signInSchema,
  signUpSchema,
  type SignInInput,
  type SignUpInput,
} from "@/lib/auth/schema";

function invalid<T extends Record<string, unknown>>(error: Parameters<typeof fieldErrors<T>>[0]) {
  return NextResponse.json(
    {
      message: "Periksa kembali kolom yang ditandai.",
      fieldErrors: fieldErrors<T>(error),
    },
    { status: 422 },
  );
}

/**
 * One boundary for both auth modes. It validates the body with the same Zod schema the
 * form uses, so no unvalidated payload ever reaches the auth layer.
 */
export async function POST(request: Request) {
  const body: unknown = await request.json().catch(() => null);

  if (typeof body !== "object" || body === null) {
    return NextResponse.json(
      { message: "Permintaan tidak terbaca." },
      { status: 400 },
    );
  }

  const mode = (body as { mode?: unknown }).mode;

  if (mode === "sign-up") {
    const parsed = signUpSchema.safeParse(body);
    if (!parsed.success) return invalid<SignUpInput>(parsed.error);
  } else if (mode === "sign-in") {
    const parsed = signInSchema.safeParse(body);
    if (!parsed.success) return invalid<SignInInput>(parsed.error);
  } else {
    return NextResponse.json({ message: "Mode tidak dikenal." }, { status: 400 });
  }

  // shortcut: Better Auth is not installed yet (US-01) — no provider, no session table.
  // This route is the contract the form already speaks; the rate limit (NFR-02, 10/min/IP)
  // arrives with it. Replace this 503 with auth.api.signUpEmail / signInEmail, set the
  // httpOnly session cookie, and answer { redirectTo } — never a client-side fake success.
  return NextResponse.json(
    {
      message:
        mode === "sign-up"
          ? "Pendaftaran akun belum aktif di lingkungan ini. Coba lagi nanti."
          : "Masuk belum aktif di lingkungan ini. Coba lagi nanti.",
    },
    { status: 503 },
  );
}
