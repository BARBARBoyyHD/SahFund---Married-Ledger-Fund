import { readFile } from "node:fs/promises";

import { expect, test } from "@playwright/test";

import {
  PASSWORD,
  createWorkspace,
  formAlert,
  newActor,
  signUp,
  uniqueEmail,
  waitForHydrated,
  waitForInteractive,
} from "./helpers";

/**
 * Task 4.4 — the invite email paths (US-52, US-53), driven from the screen.
 *
 * Locally there is no `RESEND_API_KEY`, so the real code path answers `fallback` every
 * time: nothing is emailed and nothing needs stubbing. The 429 case spends the real
 * 10/hour budget (`rate_limits`, keyed `ws:<id>`) instead of mocking a response, so the
 * message, the status and `retry-after` are the server's, not a fixture's.
 */

// The dev server compiles each route on first hit and this file signs up several
// accounts per test; 30 s is the wrong budget for that.
test.describe.configure({ timeout: 120_000 });

test.describe("US-52: sending the pocket invite", () => {
  test("with no RESEND_API_KEY the screen falls back to a copyable code, link and a live retry", async ({
    browser,
  }) => {
    const owner = await newActor(browser, "owner");
    await signUp(owner.page, "Ayu Undangan", uniqueEmail("owner-invite"));
    const { code } = await createWorkspace(owner.page, "Nikah Undangan");

    const sent: number[] = [];
    owner.page.on("response", (response) => {
      if (response.request().method() === "POST" && response.url().endsWith("/invite")) {
        sent.push(response.status());
      }
    });

    await waitForInteractive(owner.page, "#undangan #email");
    await owner.page.getByLabel(/email pasangan/i).fill(uniqueEmail("pasangan"));
    const first = owner.page.waitForResponse(
      (response) => response.request().method() === "POST" && response.url().endsWith("/invite"),
    );
    await owner.page.getByRole("button", { name: /kirim undangan/i }).click();

    const answered = await first;
    expect(answered.status()).toBe(200);
    expect(await answered.json()).toMatchObject({ status: "fallback", code });

    // The panel is the contract of the fallback scenario: an explanation, the code, the
    // join link, and a retry that is not a dead button.
    const panel = owner.page.getByText("Email belum terkirim.").locator("..");
    await expect(panel).toBeVisible();
    await expect(panel.locator("p.font-mono")).toHaveText(code);
    await expect(panel.getByRole("link")).toHaveAttribute(
      "href",
      new RegExp(`/join\\?code=${code}$`),
    );

    const retry = panel.getByRole("button", { name: /coba kirim lagi/i });
    await expect(retry).toBeEnabled();

    const second = owner.page.waitForResponse(
      (response) => response.request().method() === "POST" && response.url().endsWith("/invite"),
    );
    await retry.click();
    expect((await second).status()).toBe(200);

    // A re-POST really happened and the screen did not collapse into an error.
    expect(sent).toEqual([200, 200]);
    await expect(panel).toBeVisible();
    await expect(retry).toBeEnabled();
    await expect(owner.page.locator("p.font-mono").first()).toHaveText(code);
  });

  test("an eleventh send in the hour renders the rate-limit message verbatim", async ({
    browser,
  }) => {
    const owner = await newActor(browser, "owner");
    await signUp(owner.page, "Ayu Batas", uniqueEmail("owner-limit"));
    const { workspaceId, code } = await createWorkspace(owner.page, "Nikah Batas");

    const email = uniqueEmail("pasangan-batas");
    await waitForInteractive(owner.page, "#undangan #email");
    await owner.page.getByLabel(/email pasangan/i).fill(email);
    const first = owner.page.waitForResponse(
      (response) => response.request().method() === "POST" && response.url().endsWith("/invite"),
    );
    await owner.page.getByRole("button", { name: /kirim undangan/i }).click();
    await first;
    await expect(owner.page.getByText("Email belum terkirim.")).toBeVisible();

    // Attempts 2..10 from the same context: no key, so each is a harmless fallback.
    for (let attempt = 0; attempt < 9; attempt++) {
      const response = await owner.page.request.post(`/api/workspaces/${workspaceId}/invite`, {
        data: { email },
      });
      expect(response.status(), `attempt ${attempt + 2} is still inside the budget`).toBe(200);
    }

    // The screen's own retry is the eleventh attempt — refused, and the server's message
    // is what the owner reads.
    const denied = owner.page.waitForResponse(
      (response) => response.request().method() === "POST" && response.url().endsWith("/invite"),
    );
    await owner.page.getByRole("button", { name: /coba kirim lagi/i }).click();
    expect((await denied).status()).toBe(429);

    await expect(formAlert(owner.page)).toHaveText(
      "Terlalu banyak percobaan. Tunggu satu jam lalu coba lagi.",
    );

    // Refused, but the invite is unaffected: the code is still on screen to share.
    await expect(owner.page.locator("p.font-mono").first()).toHaveText(code);

    // The raw contract too: 429, one-hour hint, no account or workspace detail.
    const raw = await owner.page.request.post(`/api/workspaces/${workspaceId}/invite`, {
      data: { email },
    });
    expect(raw.status()).toBe(429);
    expect(raw.headers()["retry-after"]).toBe("3600");
    expect(await raw.json()).toEqual({
      message: "Terlalu banyak percobaan. Tunggu satu jam lalu coba lagi.",
    });
  });
});

test.describe("US-53: joining from the invite link", () => {
  test("the signed-out link carries `next` through sign-in, pre-fills the code and joins on one confirmation", async ({
    browser,
  }) => {
    const owner = await newActor(browser, "owner");
    await signUp(owner.page, "Ayu Tautan", uniqueEmail("owner-link"));
    const { workspaceId, code } = await createWorkspace(owner.page, "Nikah Tautan");

    // The partner has an account but is signed out when the link is opened — the email
    // link arrives in a browser that may or may not hold a session.
    const partnerEmail = uniqueEmail("partner-link");
    const partner = await newActor(browser, "partner");
    await signUp(partner.page, "Budi Tautan", partnerEmail);
    const signOut = partner.page.getByRole("button", { name: /^keluar$/i });
    await waitForHydrated(signOut);
    await signOut.click();
    await partner.page.waitForURL(/\/login$/);

    await partner.page.goto(`/join?code=${code}`);
    const cta = partner.page.getByRole("link", { name: /masuk untuk bergabung/i });
    await expect(cta).toBeVisible();
    // The code travels in `next`, so signing in returns to this exact join URL.
    await expect(cta).toHaveAttribute(
      "href",
      `/login?mode=masuk&next=${encodeURIComponent(`/join?code=${code}`)}`,
    );
    await expect(partner.page.locator("code")).toHaveText(code);

    await cta.click();
    await expect(partner.page.getByRole("button", { name: /^masuk$/i })).toBeVisible();
    await waitForInteractive(partner.page, "#email");
    await partner.page.getByLabel(/^email$/i).fill(partnerEmail);
    await partner.page.getByLabel(/kata sandi/i).fill(PASSWORD);
    await partner.page.getByRole("button", { name: /^masuk$/i }).click();

    await partner.page.waitForURL(new RegExp(`/join\\?code=${code}$`), { timeout: 20_000 });
    await waitForInteractive(partner.page, "#code");
    await expect(partner.page.getByRole("textbox", { name: /kode undangan/i })).toHaveValue(code);

    await partner.page.getByRole("button", { name: /gabung ke workspace/i }).click();
    await partner.page.waitForURL(new RegExp(`/w/${workspaceId}$`), { timeout: 20_000 });
    await expect(partner.page.getByRole("heading", { level: 1 })).toHaveText("Nikah Tautan");
  });

  test("a link whose code was rotated away shows the invalid-code message, never an error dump", async ({
    browser,
  }) => {
    const owner = await newActor(browser, "owner");
    await signUp(owner.page, "Ayu Rotasi", uniqueEmail("owner-rotate"));
    const { code } = await createWorkspace(owner.page, "Nikah Rotasi");

    const partner = await newActor(browser, "partner");
    await signUp(partner.page, "Budi Rotasi", uniqueEmail("partner-rotate"));

    owner.page.once("dialog", (dialog) => dialog.accept());
    const rotate = owner.page.getByRole("button", { name: /ganti kode undangan/i });
    await waitForHydrated(rotate);
    await rotate.click();
    await expect(owner.page.getByText(/kode undangan sudah diganti/i)).toBeVisible();
    // `router.refresh()` re-reads the row; under parallel workers the dev server can take
    // a few seconds to answer, so give the new code room to replace the old one.
    await expect(owner.page.locator("p.font-mono").first()).not.toHaveText(code, {
      timeout: 30_000,
    });

    // The older email's link: the pre-fill still works, the confirmation is refused.
    await partner.page.goto(`/join?code=${code}`);
    await waitForInteractive(partner.page, "#code");
    await expect(partner.page.getByRole("textbox", { name: /kode undangan/i })).toHaveValue(code);
    await partner.page.getByRole("button", { name: /gabung ke workspace/i }).click();

    await expect(formAlert(partner.page)).toHaveText("Kode undangan tidak valid.");
    // Still a working screen: the form and its submit are alive for a retry.
    await expect(partner.page.getByRole("button", { name: /gabung ke workspace/i })).toBeEnabled();
    await expect(partner.page.getByRole("heading", { name: /gabung ke workspace/i })).toBeVisible();
  });

  test("a link for a workspace that already has two members shows the full-workspace message", async ({
    browser,
  }) => {
    const owner = await newActor(browser, "owner");
    await signUp(owner.page, "Ayu Penuh", uniqueEmail("owner-full"));
    const { code } = await createWorkspace(owner.page, "Nikah Penuh");

    const partner = await newActor(browser, "partner");
    await signUp(partner.page, "Budi Penuh", uniqueEmail("partner-full"));
    await partner.page.goto(`/join?code=${code}`);
    await waitForInteractive(partner.page, "#code");
    await partner.page.getByRole("button", { name: /gabung ke workspace/i }).click();
    await partner.page.waitForURL(/\/w\//, { timeout: 20_000 });

    const third = await newActor(browser, "third");
    await signUp(third.page, "Citra Penuh", uniqueEmail("third-full"));
    await third.page.goto(`/join?code=${code}`);
    await waitForInteractive(third.page, "#code");
    await third.page.getByRole("button", { name: /gabung ke workspace/i }).click();

    await expect(formAlert(third.page)).toHaveText(
      "Workspace ini sudah penuh. Maksimal dua anggota per workspace.",
    );
    await expect(third.page).toHaveURL(new RegExp(`/join\\?code=${code}$`));
  });

  test("a link for another workspace shows the already-elsewhere message", async ({ browser }) => {
    const ownerA = await newActor(browser, "owner-a");
    await signUp(ownerA.page, "Ayu Satu", uniqueEmail("owner-one"));
    const { workspaceId: workspaceA, code: codeA } = await createWorkspace(ownerA.page, "Nikah Satu");

    const ownerB = await newActor(browser, "owner-b");
    await signUp(ownerB.page, "Budi Dua", uniqueEmail("owner-two"));
    const { code: codeB } = await createWorkspace(ownerB.page, "Nikah Dua");

    const guest = await newActor(browser, "guest");
    await signUp(guest.page, "Citra Tiga", uniqueEmail("guest-three"));
    await guest.page.goto(`/join?code=${codeA}`);
    await waitForInteractive(guest.page, "#code");
    await guest.page.getByRole("button", { name: /gabung ke workspace/i }).click();
    await guest.page.waitForURL(new RegExp(`/w/${workspaceA}$`), { timeout: 20_000 });

    // Own workspace's code again: told it is already a member here.
    await guest.page.goto(`/join?code=${codeA}`);
    await waitForInteractive(guest.page, "#code");
    await guest.page.getByRole("button", { name: /gabung ke workspace/i }).click();
    await expect(formAlert(guest.page)).toHaveText("Anda sudah menjadi anggota workspace ini.");

    // Another workspace's link, while holding a membership: the code is valid, the
    // account cannot be in two workspaces (UNIQUE(members.userId)).
    await guest.page.goto(`/join?code=${codeB}`);
    await waitForInteractive(guest.page, "#code");
    await expect(guest.page.getByRole("textbox", { name: /kode undangan/i })).toHaveValue(codeB);
    await guest.page.getByRole("button", { name: /gabung ke workspace/i }).click();
    await expect(formAlert(guest.page)).toHaveText(
      "Akun ini sudah tergabung di workspace lain. Satu akun hanya untuk satu workspace.",
    );
    await expect(guest.page).toHaveURL(new RegExp(`/join\\?code=${codeB}$`));
  });
});

test.describe("US-52: log hygiene", () => {
  test("an invite attempt logs neither the pocket code nor the recipient's address", async ({
    browser,
  }) => {
    // The only local log surface is the dev server's stdout. `npm run test:e2e` starts
    // that server itself and keeps its output in the console, so this assertion needs
    // the file the harness was redirected to; without it there is nothing to read.
    //
    // Scope: this audits what *our code* logs. `next dev` also prints a request line per
    // request, so a code that travels in a join URL (`GET /join?code=…`) shows up there —
    // framework output, not an application log, and the reason this test never opens one.
    const logPath = process.env.E2E_SERVER_LOG;
    test.skip(!logPath, "set E2E_SERVER_LOG to the dev server's stdout file to audit it");
    if (!logPath) return;

    const owner = await newActor(browser, "owner");
    await signUp(owner.page, "Ayu Log", uniqueEmail("owner-log"));
    const { code } = await createWorkspace(owner.page, "Nikah Log");

    const recipient = uniqueEmail("pasangan-log");
    await waitForInteractive(owner.page, "#undangan #email");
    await owner.page.getByLabel(/email pasangan/i).fill(recipient);
    const answered = owner.page.waitForResponse(
      (response) => response.request().method() === "POST" && response.url().endsWith("/invite"),
    );
    await owner.page.getByRole("button", { name: /kirim undangan/i }).click();
    expect((await answered).status()).toBe(200);
    await expect(owner.page.getByText("Email belum terkirim.")).toBeVisible();

    // Positive control: the surface is real and carries this attempt's log line, so the
    // absence assertions below are not passing against an empty or stale file.
    await expect
      .poll(async () => readFile(logPath, "utf8"), { timeout: 10_000 })
      .toContain("[invite] send failed");

    const log = await readFile(logPath, "utf8");
    expect(log).not.toContain(code);
    expect(log).not.toContain(recipient);
  });
});
