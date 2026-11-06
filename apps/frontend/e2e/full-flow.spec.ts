import { expect, test } from "@playwright/test";

import { createWorkspace, formAlert, newActor, signUp, uniqueEmail, waitForHydrated, waitForInteractive } from "./helpers";

/**
 * Task 5.1 — the PEP M1 acceptance walk, one test end to end: sign-up → create →
 * partner joins by pocket code → rotate → wedding date and budget → sign-out → the
 * non-member denial.
 *
 * One test on purpose: each step's precondition is the previous step's committed state,
 * and the sequence is what M1 promises. Everything runs against the local D1 the e2e
 * server applies migrations to — no fixtures, no seeded rows.
 */

// One long walk: cold-route compiles on the dev server plus four accounts need room.
test.describe.configure({ timeout: 180_000 });

test("PEP M1: two accounts share one workspace, the code rotates, and an outsider sees nothing", async ({
  browser,
}) => {
  // --- US-01: sign-up lands on workspace creation, not on a dashboard.
  const owner = await newActor(browser, "owner");
  await signUp(owner.page, "Ayu Prameswari", uniqueEmail("owner-flow"));
  expect(new URL(owner.page.url()).pathname).toBe("/workspaces/new");

  // --- US-05: create → the workspace shell, with the missing-date prompt (not a broken forecast).
  const { workspaceId, code } = await createWorkspace(owner.page, "Nikah Ayu & Budi");
  expect(new URL(owner.page.url()).pathname).toBe(`/w/${workspaceId}`);
  await expect(
    owner.page.getByRole("heading", { name: /tanggal pernikahan belum diatur/i }),
  ).toBeVisible();
  await expect(owner.page.locator("p.font-mono").first()).toHaveText(code);

  // --- US-06: the partner joins with the pocket code, by hand (the same path the email
  // link uses), and lands in the same shared shell.
  const partner = await newActor(browser, "partner");
  await signUp(partner.page, "Budi Santoso", uniqueEmail("partner-flow"));
  await partner.page.goto("/join");
  await waitForInteractive(partner.page, "#code");
  await partner.page.getByRole("textbox", { name: /kode undangan/i }).fill(code);
  await partner.page.getByRole("button", { name: /gabung ke workspace/i }).click();
  await partner.page.waitForURL(new RegExp(`/w/${workspaceId}$`), { timeout: 20_000 });

  await expect(partner.page.getByRole("heading", { level: 1 })).toHaveText("Nikah Ayu & Budi");
  await expect(partner.page.locator("p.font-mono").first()).toHaveText(code);
  // The member sees the same data and the member affordance: sending and rotating are
  // the owner's, and the screen says so instead of hiding the panel.
  await expect(partner.page.getByText(/hanya pemilik workspace/i)).toBeVisible();
  await expect(
    partner.page.getByRole("heading", { name: /tanggal pernikahan belum diatur/i }),
  ).toBeVisible();

  // --- US-07: the owner rotates; the old code is dead immediately and the members stay.
  const rotate = owner.page.getByRole("button", { name: /ganti kode undangan/i });
  await waitForHydrated(rotate);
  owner.page.once("dialog", (dialog) => dialog.accept());
  await rotate.click();
  await expect(owner.page.getByText(/kode undangan sudah diganti/i)).toBeVisible();
  await expect(owner.page.locator("p.font-mono").first()).not.toHaveText(code, {
    timeout: 30_000,
  });
  const rotated = (await owner.page.locator("p.font-mono").first().innerText()).trim();
  expect(rotated).not.toBe(code);

  await partner.page.goto(`/join?code=${code}`);
  await waitForInteractive(partner.page, "#code");
  await partner.page.getByRole("button", { name: /gabung ke workspace/i }).click();
  await expect(formAlert(partner.page)).toHaveText("Kode undangan tidak valid.");

  // Memberships survived the rotation: the partner still reads the workspace.
  await partner.page.goto(`/w/${workspaceId}`);
  await expect(partner.page.getByRole("heading", { level: 1 })).toHaveText("Nikah Ayu & Budi");

  // --- US-08: date and budget from the settings form; the prompt goes, the date renders
  // in id-ID through `src/core/money.ts` (never a raw ISO string or en-US grouping).
  await waitForInteractive(owner.page, "#tanggal-pernikahan");
  await owner.page.locator("#tanggal-pernikahan").fill("2027-06-03");
  await owner.page.locator("#target-anggaran").fill("150.000.000");
  await owner.page.getByRole("button", { name: /simpan perubahan/i }).click();
  await expect(owner.page.getByText("Perubahan tersimpan.")).toBeVisible();

  await expect(
    owner.page.getByRole("heading", { name: /tanggal pernikahan belum diatur/i }),
  ).toHaveCount(0);
  await expect(owner.page.getByText(/Hari H:/)).toContainText("3 Juni 2027");

  // Reloaded, so the values are read back from D1 and formatted by `money.ts` on the
  // server — the form's own state cannot make this assertion pass.
  await owner.page.reload();
  await expect(owner.page.locator("#tanggal-pernikahan")).toHaveValue("2027-06-03");
  await expect(owner.page.locator("#target-anggaran")).toHaveValue("Rp 150.000.000");

  // --- US-03: sign-out clears the cookie and lands on /login; the dashboard then
  // redirects server-side (307) instead of rendering anything.
  const signOut = owner.page.getByRole("button", { name: /^keluar$/i });
  await waitForHydrated(signOut);
  await signOut.click();
  await owner.page.waitForURL(/\/login$/, { timeout: 20_000 });
  const dashboard = await owner.page.request.get("/dashboard", { maxRedirects: 0 });
  expect(dashboard.status()).toBe(307);
  expect(dashboard.headers()["location"]).toContain("/login");

  // --- US-04: a signed-in non-member asking for the id gets the not-found screen, and
  // none of the workspace's data is in the DOM. This is the assertion that matters: a
  // 200 with the row leaked is the bug class, so absence is checked, not the status.
  const outsider = await newActor(browser, "outsider");
  await signUp(outsider.page, "Citra Lain", uniqueEmail("outsider-flow"));
  await outsider.page.goto(`/w/${workspaceId}`);
  await expect(outsider.page.getByRole("heading", { name: /halaman ini tidak ada/i })).toBeVisible();

  const html = await outsider.page.content();
  expect(html).not.toContain("Nikah Ayu & Budi");
  expect(html).not.toContain(rotated);
  expect(html).not.toContain("150.000.000");
  expect(html).not.toContain("Rp 150.000.000");
});
