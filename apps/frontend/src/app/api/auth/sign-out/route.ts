import { NextResponse } from "next/server";

import { getAuth } from "@/lib/auth/auth";

/**
 * Sign-out is not an auth attempt, so it never touches the NFR-02 counter (design D1).
 * Better Auth deletes the session row; this handler only relays the cleared cookie.
 */
export async function POST(request: Request) {
  try {
    const answered = await getAuth().api.signOut({
      headers: request.headers,
      returnHeaders: true,
    });

    const response = NextResponse.json({ redirectTo: "/login" }, { status: 200 });
    for (const cookie of answered.headers.getSetCookie()) {
      response.headers.append("set-cookie", cookie);
    }
    return response;
  } catch (error) {
    console.error("[auth] sign-out failed", {
      route: "POST /api/auth/sign-out",
      status: 503,
      cause: error instanceof Error ? error.name : typeof error,
    });
    return NextResponse.json(
      { message: "Gagal keluar. Coba lagi sebentar lagi." },
      { status: 503 },
    );
  }
}
