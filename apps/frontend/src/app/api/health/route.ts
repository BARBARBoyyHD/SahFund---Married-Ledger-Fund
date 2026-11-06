import { connection } from "next/server";
import { probeDb } from "@/lib/db";

export async function GET() {
  // A probe must report live state: require a real request, never prerender it
  // (cacheComponents replaced the `dynamic = "force-dynamic"` segment config).
  await connection();

  try {
    await probeDb();
    return Response.json(
      { status: "ok", db: "up" },
      { headers: { "cache-control": "no-store" } },
    );
  } catch (error) {
    // No error detail in the body (AGENTS.md §8); the error's name only in logs (§11.9).
    console.error("[health] database probe failed", {
      cause: error instanceof Error ? error.name : typeof error,
    });
    return Response.json(
      { status: "error", db: "down", message: "Database tidak dapat dihubungi. Coba lagi." },
      { status: 503, headers: { "cache-control": "no-store" } },
    );
  }
}
