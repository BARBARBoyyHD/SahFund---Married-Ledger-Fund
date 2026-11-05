import { getCloudflareContext } from "@opennextjs/cloudflare";
import { NextResponse } from "next/server";

import { getDb } from "@/lib/db";
import { invalid, logFailure, unavailable } from "@/lib/http";
import { membershipForApi } from "@/lib/membership";
import { WORKSPACE_MESSAGE } from "@/lib/workspace/messages";
import { inviteSchema } from "@/lib/workspace/schema";
import { sendInvite } from "@/lib/workspace/service";

/**
 * Send the pocket invite (US-52) — owner only. The NFR-02 budget is spent before the
 * email leaves, so a failed send still counts and a refused send counts nothing. Any
 * send failure answers `fallback` with the code and join link: the screen shows them for
 * manual copying plus a retry (never a dead button, never a swallowed error).
 */
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  const access = await membershipForApi(id);
  if (!access.ok) return access.response;
  if (access.role !== "owner") {
    return NextResponse.json({ message: WORKSPACE_MESSAGE.ownerOnly }, { status: 403 });
  }

  const body: unknown = await request.json().catch(() => null);
  const parsed = inviteSchema.safeParse(body ?? {});
  if (!parsed.success) return invalid(parsed.error);

  try {
    const { env } = getCloudflareContext();
    const result = await sendInvite(getDb(), id, parsed.data.email, {
      origin: new URL(request.url).origin,
      mail: { apiKey: env.RESEND_API_KEY, from: env.RESEND_FROM },
    });

    switch (result.status) {
      case "sent":
        return NextResponse.json({ status: "sent" });
      case "fallback":
        return NextResponse.json({
          status: "fallback",
          code: result.code,
          joinUrl: result.joinUrl,
        });
      case "rate-limited":
        return NextResponse.json(
          { message: WORKSPACE_MESSAGE.rateLimited },
          { status: 429, headers: { "retry-after": "3600" } },
        );
      default:
        return unavailable();
    }
  } catch (error) {
    logFailure("POST /api/workspaces/[id]/invite", error);
    return unavailable();
  }
}
