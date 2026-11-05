import { APIError } from "better-auth/api";
import { NextResponse } from "next/server";

import { getAuth } from "@/lib/auth/auth";
import { AUTH_LIMIT, allowAttempt, clientKey } from "@/lib/auth/rate-limit";
import {
  fieldErrors,
  signInSchema,
  signUpSchema,
  type SignInInput,
  type SignUpInput,
} from "@/lib/auth/schema";
import { getDb } from "@/lib/db";

function invalid<T extends Record<string, unknown>>(error: Parameters<typeof fieldErrors<T>>[0]) {
  return NextResponse.json(
    {
      message: "Periksa kembali kolom yang ditandai.",
      fieldErrors: fieldErrors<T>(error),
    },
    { status: 422 },
  );
}

/** Better Auth speaks English error codes; the user reads Bahasa Indonesia (§8). */
function authFailure(error: unknown) {
  if (error instanceof APIError) {
    const code = error.body?.code;

    if (code === "USER_ALREADY_EXISTS" || code === "USER_ALREADY_EXISTS_USE_ANOTHER_EMAIL") {
      return NextResponse.json(
        {
          message: "Email ini sudah terdaftar. Coba masuk.",
          fieldErrors: { email: "Email ini sudah terdaftar." },
        },
        { status: 409 },
      );
    }

    // Deliberately the same answer for unknown email and wrong password.
    if (code === "INVALID_EMAIL_OR_PASSWORD") {
      return NextResponse.json(
        { message: "Email atau kata sandi belum cocok." },
        { status: 401 },
      );
    }

    console.error("auth: rejected request", { route: "POST /api/auth", code, status: error.statusCode });
    return NextResponse.json(
      { message: "Permintaan belum bisa diproses. Periksa kembali data Anda." },
      { status: 400 },
    );
  }

  // Missing secret, D1 unreachable, anything unexpected: generic message, real cause to logs.
  console.error("auth: request failed", {
    route: "POST /api/auth",
    status: 503,
    cause: error instanceof Error ? error.message : typeof error,
  });
  return NextResponse.json(
    { message: "Layanan masuk sedang tidak tersedia. Coba lagi sebentar lagi." },
    { status: 503 },
  );
}

/**
 * One boundary for both auth modes. It validates the body with the same Zod schema the
 * form uses, so no unvalidated payload ever reaches Better Auth. The session cookie is
 * set by Better Auth itself — this handler only relays it.
 */
export async function POST(request: Request) {
  if (!(await allowAttempt(getDb(), `ip:${clientKey(request)}`, AUTH_LIMIT))) {
    return NextResponse.json(
      { message: "Terlalu banyak percobaan. Tunggu satu menit lalu coba lagi." },
      { status: 429, headers: { "retry-after": "60" } },
    );
  }

  const body: unknown = await request.json().catch(() => null);

  if (typeof body !== "object" || body === null) {
    return NextResponse.json(
      { message: "Permintaan tidak terbaca." },
      { status: 400 },
    );
  }

  const mode = (body as { mode?: unknown }).mode;
  let attempt: { kind: "sign-up"; input: SignUpInput } | { kind: "sign-in"; input: SignInInput };

  if (mode === "sign-up") {
    const parsed = signUpSchema.safeParse(body);
    if (!parsed.success) return invalid<SignUpInput>(parsed.error);
    attempt = { kind: "sign-up", input: parsed.data };
  } else if (mode === "sign-in") {
    const parsed = signInSchema.safeParse(body);
    if (!parsed.success) return invalid<SignInInput>(parsed.error);
    attempt = { kind: "sign-in", input: parsed.data };
  } else {
    return NextResponse.json({ message: "Mode tidak dikenal." }, { status: 400 });
  }

  try {
    const auth = getAuth();
    const answered =
      attempt.kind === "sign-up"
        ? await auth.api.signUpEmail({
            body: attempt.input,
            headers: request.headers,
            returnHeaders: true,
          })
        : await auth.api.signInEmail({
            body: attempt.input,
            headers: request.headers,
            returnHeaders: true,
          });

    // shortcut: no dashboard route yet (PEP M2) — land on "/" until it exists.
    const response = NextResponse.json({ redirectTo: "/" }, { status: 200 });
    for (const cookie of answered.headers.getSetCookie()) {
      response.headers.append("set-cookie", cookie);
    }
    return response;
  } catch (error) {
    return authFailure(error);
  }
}
