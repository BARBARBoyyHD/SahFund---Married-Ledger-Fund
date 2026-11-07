import { NextResponse } from "next/server";
import type { ZodError } from "zod";

import { rateLimitMessage } from "@/lib/auth/rate-limit";
import { fieldErrors } from "@/lib/validation";

/**
 * The HTTP shapes every mutation answers with (AGENTS §8): a JSON body the form renders
 * verbatim, and a log line that carries the route and status only — never a row, an
 * amount, a pocket code, or an email (ITA §11.9).
 */

/** 422 for a failed shared-schema parse; the form paints `fieldErrors` inline. */
export function invalid(error: ZodError) {
  const fields = fieldErrors<Record<string, unknown>>(error);
  const message = Object.keys(fields).length
    ? "Periksa kembali kolom yang ditandai."
    : (error.issues[0]?.message ?? "Periksa kembali data Anda.");

  return NextResponse.json({ message, fieldErrors: fields }, { status: 422 });
}

/** 401 when a handler has no session — the membership guard answers the same way. */
export function unauthenticated() {
  return NextResponse.json(
    { message: "Sesi Anda sudah berakhir. Silakan masuk lagi." },
    { status: 401 },
  );
}

/** 403 when a free workspace hits a paid-only action; the UI renders `message` verbatim. */
export function locked(message: string) {
  return NextResponse.json({ message }, { status: 403 });
}

/** 429 for a spent NFR-02 window (US-45): the limit and the retry timing, rendered verbatim. */
export function rateLimited(what: string, windowMs: number) {
  return NextResponse.json(
    { message: rateLimitMessage(what, windowMs) },
    { status: 429, headers: { "retry-after": String(Math.ceil(windowMs / 1000)) } },
  );
}

/** 503 when the database or another dependency is unavailable — never a blank screen. */
export function unavailable() {
  return NextResponse.json(
    { message: "Layanan sedang tidak tersedia. Coba lagi sebentar lagi." },
    { status: 503 },
  );
}

/**
 * The one route log line (design D5, US-42): route, status and workspace id, nothing
 * else. Used where an outcome is worth evidence — a refusal or a deletion — never a row.
 */
export function logRoute(route: string, status: number, workspaceId?: string | null) {
  console.info("[api] route", { route, status, ...(workspaceId ? { workspaceId } : {}) });
}

export function logFailure(route: string, error: unknown) {
  console.error("[api] request failed", {
    route,
    status: 503,
    cause: error instanceof Error ? error.name : typeof error,
  });
}
