import { expect, test } from "@playwright/test";

import {
  createWorkspace,
  formAlert,
  newActor,
  openDashboardMenu,
  openInvite,
  signUp,
  uniqueEmail,
  waitForHydrated,
  waitForInteractive,
} from "./helpers";

/**
 * Task 5.1 / PEP M1 acceptance walk, one test end to end: sign-up → create → partner joins
 * by pocket code → import → report → rotate → wedding date and budget → sign-out → the
 * non-member sees nothing.
 *
 * One test on purpose: each step's precondition is the previous step's committed state,
 * and the sequence is what M1 promises. Everything runs against the local D1 the e2e
 * server applies migrations to — no fixtures, no seeded rows.
 */

// One long walk: cold-route compiles on the dev server plus four accounts need room.
test.describe.configure({ timeout: 240_000 });

/** A CSV that reconciles row by row: each saldo is the previous saldo plus the nominal. */
const STATEMENT = [
  "Tanggal,Keterangan,Nominal,Saldo",
  "2026-11-02,Setoran awal,5.000.000,5.000.000",
  "2026-11-03,Bayar katering,-1.500.000,3.500.000",
].join("\n");

test("PEP M1: two accounts share one workspace, an import reaches the report, and an outsider sees nothing", async ({
  browser,
}) => {
  // --- US-01: sign-up lands on workspace creation, not on a dashboard.
  const owner = await newActor(browser, "owner");
  await signUp(owner.page, "Ayu Prameswari", uniqueEmail("owner-flow"));
  expect(new URL(owner.page.url()).pathname).toBe("/workspaces/new");

  // --- US-05: create → the one dashboard, stating the missing date instead of a broken
  // forecast, with the pocket code on offer in the invite dialog.
  const { code } = await createWorkspace(owner.page, "Nikah Ayu & Budi");
  expect(new URL(owner.page.url()).pathname).toBe("/dashboard");
  await expect(owner.page.getByText(/tanggal pernikahan belum diatur/i)).toBeVisible();

  const ownerInvite = await openInvite(owner.page);
  await expect(ownerInvite.locator("p.font-mono").first()).toHaveText(code);
  await owner.page.keyboard.press("Escape");
  await expect(ownerInvite).toBeHidden();

  // --- US-06: the partner joins with the pocket code, by hand (the same path the email
  // link uses), and lands in the same shared dashboard.
  const partner = await newActor(browser, "partner");
  await signUp(partner.page, "Budi Santoso", uniqueEmail("partner-flow"));
  await partner.page.goto("/join");
  await waitForInteractive(partner.page, "#code");
  await partner.page.getByRole("textbox", { name: /kode undangan/i }).fill(code);
  await partner.page.getByRole("button", { name: /gabung ke workspace/i }).click();
  await partner.page.waitForURL(/\/dashboard$/, { timeout: 20_000 });

  await expect(partner.page.getByRole("heading", { level: 1 })).toHaveText("Nikah Ayu & Budi");
  // The member sees the same data and the member affordance: sending and rotating are
  // the owner's, and the screen says so instead of hiding the panel.
  const partnerInvite = await openInvite(partner.page);
  await expect(partnerInvite.getByText(/hanya pemilik workspace/i)).toBeVisible();
  await partner.page.keyboard.press("Escape");

  // --- US-09–US-17: the CSV is parsed on the device, reconciles against its own balance
  // chain, and commits. The first import is free (US-35).
  await owner.page.goto("/dashboard/imports");
  await waitForInteractive(owner.page, "#berkas-mutasi");
  await owner.page.locator("#berkas-mutasi").setInputFiles({
    name: "mutasi-november.csv",
    mimeType: "text/csv",
    buffer: Buffer.from(STATEMENT),
  });
  await owner.page.getByRole("button", { name: /lanjut ke pratinjau/i }).click();

  await expect(owner.page.getByText("Cocok dengan saldo bank")).toBeVisible();
  await owner.page.getByRole("button", { name: /^impor 2 transaksi$/i }).click();
  await expect(owner.page.getByRole("heading", { name: /impor tersimpan/i })).toBeVisible();
  await expect(owner.page.getByText(/2 transaksi baru/)).toBeVisible();

  // --- US-25: the report reads the stored rows — money in, money out, and the
  // unattributed line, all through `core/money.ts` (never en-US grouping).
  await owner.page.goto("/dashboard/laporan");
  const kontribusi = owner.page.locator("section[aria-labelledby='kontribusi-judul']");
  await expect(kontribusi.getByText("Belum teratribusi")).toBeVisible();
  await expect(kontribusi).toContainText("Rp 5.000.000");
  await expect(kontribusi).toContainText("Rp 1.500.000");
  await expect(kontribusi).toContainText("Rp 3.500.000");

  // --- US-07: the owner rotates; the old code is dead immediately and the members stay.
  await owner.page.goto("/dashboard");
  const rotateInvite = await openInvite(owner.page);
  const rotate = rotateInvite.getByRole("button", { name: /ganti kode undangan/i });
  owner.page.once("dialog", (dialog) => dialog.accept());
  await rotate.click();
  await expect(
    rotateInvite.getByText(/kode undangan sudah diganti/i),
  ).toBeVisible();
  await expect(rotateInvite.locator("p.font-mono").first()).not.toHaveText(code, {
    timeout: 30_000,
  });
  const rotated = (await rotateInvite.locator("p.font-mono").first().innerText()).trim();
  expect(rotated).not.toBe(code);
  await owner.page.keyboard.press("Escape");

  await partner.page.goto(`/join?code=${code}`);
  await waitForInteractive(partner.page, "#code");
  await partner.page.getByRole("button", { name: /gabung ke workspace/i }).click();
  await expect(formAlert(partner.page)).toHaveText("Kode undangan tidak valid.");

  // Memberships survived the rotation: the partner still reads the workspace.
  await partner.page.goto("/dashboard");
  await expect(partner.page.getByRole("heading", { level: 1 })).toHaveText("Nikah Ayu & Budi");

  // --- US-08: date and budget from the settings dialog; the prompt goes, the date renders
  // in id-ID through `src/core/money.ts` (never a raw ISO string or en-US grouping).
  const settings = owner.page.getByRole("menuitem", { name: /^pengaturan$/i });
  await openDashboardMenu(owner.page);
  await waitForHydrated(settings);
  await settings.click();
  const settingsDialog = owner.page.getByRole("dialog", { name: /pengaturan/i });
  await expect(settingsDialog).toBeVisible();
  await settingsDialog.locator("#tanggal-pernikahan").fill("2027-06-03");
  await settingsDialog.locator("#target-anggaran").fill("150.000.000");
  await settingsDialog.getByRole("button", { name: /simpan perubahan/i }).click();
  await expect(settingsDialog.getByText("Perubahan tersimpan.")).toBeVisible();

  await expect(owner.page.getByText(/tanggal pernikahan belum diatur/i)).toHaveCount(0);
  await expect(owner.page.getByText(/Menuju 3 Juni 2027/)).toBeVisible();

  // Reloaded, so the values are read back from D1 and formatted by `money.ts` on the
  // server — the form's own state cannot make this assertion pass.
  await owner.page.reload();
  await openDashboardMenu(owner.page);
  await settings.click();
  await expect(settingsDialog.locator("#tanggal-pernikahan")).toHaveValue("2027-06-03");
  await expect(settingsDialog.locator("#target-anggaran")).toHaveValue("Rp 150.000.000");
  await owner.page.keyboard.press("Escape");

  // --- US-03: sign-out clears the cookie and lands on /login; the dashboard then
  // redirects server-side (307) instead of rendering anything.
  const signOut = owner.page.getByRole("menuitem", { name: /^keluar$/i });
  await openDashboardMenu(owner.page);
  await waitForHydrated(signOut);
  await signOut.click();
  await owner.page.waitForURL(/\/login$/, { timeout: 20_000 });
  const dashboard = await owner.page.request.get("/dashboard", { maxRedirects: 0 });
  expect(dashboard.status()).toBe(307);
  expect(dashboard.headers()["location"]).toContain("/login");

  // --- US-04: a signed-in non-member asking for a workspace gets its own empty
  // dashboard, and none of the other workspace's data is in the DOM. This is the
  // assertion that matters: a 200 with the row leaked is the bug class, so absence is
  // checked, not the status.
  const outsider = await newActor(browser, "outsider");
  await signUp(outsider.page, "Citra Lain", uniqueEmail("outsider-flow"));
  await outsider.page.goto("/dashboard");
  await expect(outsider.page.getByRole("heading", { name: /belum ada workspace/i })).toBeVisible();

  const html = await outsider.page.content();
  expect(html).not.toContain("Nikah Ayu & Budi");
  expect(html).not.toContain(code);
  expect(html).not.toContain(rotated);
  expect(html).not.toContain("5.000.000");
  expect(html).not.toContain("Rp 150.000.000");
});
