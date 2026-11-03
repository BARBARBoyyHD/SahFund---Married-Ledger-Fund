import { test, expect, type Page } from "@playwright/test";

// Requirements source: openspec/specs/ is empty in this repo, so the acceptance
// criteria below are traced to docs/projects/BRD.md and docs/ui/DESIGN.md.

function trackConsoleErrors(page: Page) {
  const errors: string[] = [];
  page.on("console", (msg) => {
    if (msg.type() === "error") errors.push(msg.text());
  });
  page.on("pageerror", (error) => errors.push(error.message));
  return errors;
}

test.describe("BRD FR-01: account and session", () => {
  test("/dashboard redirects anonymous visitors to /login", async ({ page }) => {
    const errors = trackConsoleErrors(page);
    await page.goto("/dashboard");
    await expect(page).toHaveURL(/\/login$/);
    expect(errors).toEqual([]);
  });

  test("/login exposes the documented email + password sign-in form", async ({ page }) => {
    await page.goto("/login");
    await expect(page.getByLabel(/email/i)).toBeVisible();
    await expect(page.getByLabel(/password/i)).toBeVisible();
    await expect(
      page.getByRole("button", { name: /sign in|masuk/i }),
    ).toBeVisible();
  });

  test("/signup collects name, email and password", async ({ page }) => {
    await page.goto("/signup");
    await expect(page.getByLabel(/name/i)).toBeVisible();
    await expect(page.getByLabel(/email/i)).toBeVisible();
    await expect(page.getByLabel(/password/i)).toBeVisible();
  });
});

test("ITA 4.1 / PEP M1: /api/health reports the database status", async ({
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
  await expect(page.locator("h1")).toContainText(/SahFund|Wedding Fund/i);
  await expect(page).toHaveTitle(/SahFund|Wedding Fund/i);
  expect(errors).toEqual([]);
});
