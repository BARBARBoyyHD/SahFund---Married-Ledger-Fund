import { redirect } from "next/navigation";

/**
 * The `/w/:id` URL is retired (design D11 revised): one dashboard, and one workspace
 * per user (`UNIQUE(members.userId)`), so there is nothing left to resolve from the id.
 * Old links and bookmarks land on the dashboard instead of a stale shell.
 */
export default function WorkspacePage() {
  redirect("/dashboard");
}
