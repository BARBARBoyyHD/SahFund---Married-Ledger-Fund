import { test, expect } from "@playwright/test";

// Task 2.7 / US-01 + AGENTS §9: the session cookie must be httpOnly, SameSite=Lax,
// and Secure in production. Better Auth derives `Secure` from the base URL protocol
// (https) / production env, so a local http run legitimately has no `Secure` — the
// assertion below only demands it when the suite itself is pointed at https.

function setCookies(response: {
  headersArray: () => { name: string; value: string }[];
}) {
  return response
    .headersArray()
    .filter((header) => header.name.toLowerCase() === "set-cookie")
    .map((header) => header.value);
}

test("US-01/AGENTS §9: sign-up and sign-in set an httpOnly, SameSite=Lax session cookie", async ({
  request,
  baseURL,
}) => {
  const email = `cookie-${Date.now()}-${Math.random().toString(16).slice(2)}@contoh.test`;
  const password = "rahasia-sekali-123";

  const signUp = await request.post("/api/auth", {
    data: { mode: "sign-up", name: "Uji Cookie", email, password },
  });
  expect(signUp.status()).toBe(200);

  const signIn = await request.post("/api/auth", {
    data: { mode: "sign-in", email, password },
  });
  expect(signIn.status()).toBe(200);

  for (const response of [signUp, signIn]) {
    const session = setCookies(response).find((cookie) =>
      cookie.includes("better-auth.session_token"),
    );
    expect(session, "the session cookie is set").toBeTruthy();
    expect(session).toMatch(/HttpOnly/i);
    expect(session).toMatch(/SameSite=Lax/i);
    if (baseURL?.startsWith("https://")) expect(session).toMatch(/;\s*Secure/i);
  }
});

test("US-04/design D12: the proxy redirect without a cookie is convenience only", async ({
  request,
}) => {
  const response = await request.get("/dashboard", { maxRedirects: 0 });
  expect(response.status()).toBe(307);
  expect(response.headers()["location"]).toContain("/login");
});
