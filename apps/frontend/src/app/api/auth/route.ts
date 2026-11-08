import { APIError } from "better-auth/api";
import { NextResponse } from "next/server";

import { getAuth } from "@/lib/auth/auth";
import { AUTH_LIMIT, allowAttempt, clientKey } from "@/lib/auth/rate-limit";
import {
  safeNext,
  signInSchema,
  signUpSchema,
  type SignInInput,
  type SignUpInput,
} from "@/lib/auth/schema";
import { getDb } from "@/lib/db";
import { invalid, rateLimited } from "@/lib/http";

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

  // Missing secret, D1 unreachable, anything unexpected: generic message to the user,
  // the error's name only to the logs — never a message, which can carry a row (AGENTS §11.9).
  console.error("auth: request failed", {
    route: "POST /api/auth",
    status: 503,
    cause: error instanceof Error ? error.name : typeof error,
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
  let allowed: boolean;
  try {
    allowed = await allowAttempt(getDb(), `ip:${clientKey(request)}`, AUTH_LIMIT);
  } catch (error) {
    // A missing binding throws here, before the limiter's own fail-open catch — answer 503.
    return authFailure(error);
  }

  if (!allowed) return rateLimited("percobaan", AUTH_LIMIT.windowMs);

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
    if (!parsed.success) return invalid(parsed.error);
    attempt = { kind: "sign-up", input: parsed.data };
  } else if (mode === "sign-in") {
    const parsed = signInSchema.safeParse(body);
    if (!parsed.success) return invalid(parsed.error);
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
            body: { email: attempt.input.email, password: attempt.input.password },
            headers: request.headers,
            returnHeaders: true,
          });

    // US-01: a new account starts at workspace creation. US-53: a sign-in may return to
    // a same-origin relative `next`; anything else lands on the dashboard (design D8).
    const redirectTo =
      attempt.kind === "sign-up"
        ? "/workspaces/new"
        : (safeNext(attempt.input.next) ?? "/dashboard");

    const response = NextResponse.json({ redirectTo }, { status: 200 });
    for (const cookie of answered.headers.getSetCookie()) {
      response.headers.append("set-cookie", cookie);
    }
    return response;
  } catch (error) {
    return authFailure(error);
  }
}
