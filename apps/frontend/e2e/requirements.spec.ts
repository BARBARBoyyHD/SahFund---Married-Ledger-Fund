import { test, expect, type Page } from "@playwright/test";

// Requirements source: openspec/specs/ is empty in this repo, so the acceptance
// criteria below are traced to docs/projects/BRD.md (FR-01, NFR-07) and
// docs/ui/DESIGN.md. Assertions target behaviour and accessible names, not
// marketing copy, so a landing rewrite does not break the suite.
//
// The runtime is the app served by `e2e:server` with a real local D1 binding
// (SPEC-d1-migration T6) — `/api/health` is the proof the database is reachable.

function trackConsoleErrors(page: Page) {
  const errors: string[] = [];
  // The dev server's HMR socket does not survive Playwright's webServer on
  // Windows ("ERR_INVALID_HTTP_RESPONSE"); production has no HMR. Application
  // console errors and page errors still fail the test.
  const HMR_NOISE = /WebSocket connection to 'ws:\/\/[^']*_next\/hmr/;
  page.on("console", (msg) => {
    if (msg.type() === "error" && !HMR_NOISE.test(msg.text())) errors.push(msg.text());
  });
  page.on("pageerror", (error) => errors.push(error.message));
  return errors;
}

test.describe("BRD FR-01: account and session", () => {
  test("/login is the single entry point and shows the sign-up form by default", async ({ page }) => {
    const errors = trackConsoleErrors(page);
    await page.goto("/login");
    await expect(
      page.getByRole("heading", { level: 1, name: /masuk atau buat akun/i }),
    ).toBeVisible();
    await expect(page.getByLabel(/nama lengkap/i)).toBeVisible();
    await expect(page.getByLabel(/^email$/i)).toBeVisible();
    await expect(page.getByLabel(/kata sandi/i)).toBeVisible();
    await expect(page.getByRole("button", { name: /buat akun/i })).toBeVisible();
    expect(errors).toEqual([]);
  });

  test("/login?mode=masuk switches to sign-in and keeps the tab in the URL (AGENTS §6)", async ({
    page,
  }) => {
    await page.goto("/login?mode=masuk");
    await expect(page.getByRole("button", { name: /^masuk$/i })).toBeVisible();
    await expect(page.getByLabel(/kata sandi/i)).toBeVisible();
    // The name field belongs to sign-up only.
    await expect(page.getByLabel(/nama lengkap/i)).toHaveCount(0);
    await expect(page.getByRole("link", { name: /^masuk$/i })).toHaveAttribute(
      "aria-current",
      "page",
    );
  });
});

test("ITA §2 / PEP M1: /api/health reports the database status", async ({
  request,
}) => {
  const response = await request.get("/api/health");
  expect(response.status()).toBe(200);
  expect(await response.json()).toMatchObject({ db: "up" });
});

test("NFR-07 + DESIGN.md: home page renders the SahFund product, no console errors", async ({
  page,
}) => {
  const errors = trackConsoleErrors(page);
  await page.goto("/");
  await expect(page).toHaveTitle(/SahFund/i);
  const heading = page.locator("h1");
  await expect(heading).toBeVisible();
  expect((await heading.innerText()).trim().length).toBeGreaterThan(0);
  expect(errors).toEqual([]);
});
