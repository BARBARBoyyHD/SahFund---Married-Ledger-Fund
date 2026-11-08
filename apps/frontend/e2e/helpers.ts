import { expect, test, type Browser, type Locator, type Page } from "@playwright/test";

/**
 * Shared setup for the auth/workspace/invite e2e specs (tasks 4.4 and 5.1).
 *
 * Two things in this suite are not obvious:
 *
 * 1. Every person needs their own browser *context* — cookies are per context, so two
 *    accounts in one test cannot share a session by accident.
 * 2. The auth limiter is keyed per client IP (10/min, NFR-02). Playwright's workers all
 *    come from 127.0.0.1, so a suite of sign-ups would rate-limit itself. Each actor
 *    sends its own `cf-connecting-ip`, which is the header the edge sets in production
 *    and the one `clientKey()` reads — the limit still runs, just in its own bucket.
 */

export const PASSWORD = "rahasia-sekali-123";

export function baseURL() {
  const url = test.info().project.use.baseURL;
  if (!url) throw new Error("playwright.config.ts must set use.baseURL");
  return url;
}

export function uniqueEmail(prefix: string) {
  return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}@contoh.test`;
}

/** A person: their own cookie jar, their own rate-limit bucket. */
export async function newActor(browser: Browser, label: string) {
  const octet = () => Math.floor(Math.random() * 250) + 2;
  const context = await browser.newContext({
    baseURL: baseURL(),
    extraHTTPHeaders: { "cf-connecting-ip": `198.18.${octet()}.${octet()}` },
  });
  const page = await context.newPage();
  // Surface client errors with the actor's name: a silent hydration failure otherwise
  // looks like "the click did nothing".
  page.on("pageerror", (error) => console.log(`[${label}] pageerror: ${error.message}`));
  return { context, page };
}

/**
 * The dev server paints before React attaches handlers, and a click before hydration
 * falls through to a native form GET (the URL becomes `/login?name=&email=…`). React
 * stamps `__reactFiber$…` on a host node when it commits, so that is the honest signal
 * that the field is interactive — no fixed sleep.
 *
 * Scope `#id` selectors that two routes share (`#email` is on both `/login` and the
 * workspace invite panel): Next 16 keeps the previous route's DOM mounted but hidden,
 * so an unscoped id matches twice. Role/label queries ignore the hidden tree.
 */
export async function waitForHydrated(locator: Locator) {
  await expect(locator).toBeVisible();
  await expect
    .poll(() => locator.evaluate((el) => Object.keys(el).some((key) => key.startsWith("__react"))))
    .toBe(true);
}

export async function waitForInteractive(page: Page, selector: string) {
  await waitForHydrated(page.locator(selector));
}

/**
 * The form's own error banner. `getByRole("alert")` alone is ambiguous: Next renders its
 * route announcer (`#__next-route-announcer__`) with the same role.
 */
export function formAlert(page: Page) {
  return page.locator('p[role="alert"]');
}

/** US-01: sign up from the UI and land on workspace creation. */
export async function signUp(page: Page, name: string, email: string) {
  await page.goto("/login");
  await waitForInteractive(page, "#name");
  await page.getByLabel(/nama lengkap/i).fill(name);
  await page.getByLabel(/^email$/i).fill(email);
  await page.getByLabel(/kata sandi/i).fill(PASSWORD);
  await page.getByRole("button", { name: /buat akun/i }).click();
  // 30 s: `next dev` compiles `/workspaces/new` on the first navigation of the run.
  await page.waitForURL(/\/workspaces\/new$/, { timeout: 30_000 });
}

/**
 * US-05: create the workspace from the UI; returns its id and pocket code.
 *
 * The URL no longer carries the workspace id (design D11 revised: one `/dashboard`), so
 * the creation response — the same body the form just consumed — is the source for both.
 */
export async function createWorkspace(page: Page, name: string) {
  await waitForInteractive(page, "#budgetTarget");
  await page.getByLabel(/nama workspace/i).fill(name);

  const created = page.waitForResponse(
    (response) =>
      response.request().method() === "POST" && new URL(response.url()).pathname === "/api/workspaces",
  );
  await page.getByRole("button", { name: /buat workspace/i }).click();
  await page.waitForURL(/\/dashboard$/, { timeout: 30_000 });

  const { id, inviteCode } = (await (await created).json()) as {
    id: string;
    inviteCode: string;
  };
  await expect(page.getByRole("heading", { level: 1 })).toHaveText(name);

  return { workspaceId: id, code: inviteCode };
}

/**
 * The dashboard header collapses its five actions into one ellipsis button, so every
 * menu-driven flow starts by opening it.
 */
export async function openDashboardMenu(page: Page) {
  const trigger = page.getByRole("button", { name: /^menu aksi$/i });
  await waitForHydrated(trigger);
  await trigger.click();
}

/**
 * US-07/US-52: the dashboard keeps the invite panel in a native `<dialog>` — the code,
 * the join link, the email form and the rotate button are all inside it.
 */
export async function openInvite(page: Page) {
  await openDashboardMenu(page);
  const trigger = page.getByRole("menuitem", { name: /^undang pasangan$/i });
  await waitForHydrated(trigger);
  await trigger.click();

  const dialog = page.getByRole("dialog", { name: /undang pasangan/i });
  await expect(dialog).toBeVisible();
  return dialog;
}
