import assert from "node:assert/strict";
import test from "node:test";

import { inviteEmail, sendInviteEmail } from "./mail.ts";

/**
 * The one email v1.0 sends (FR-13): text only, Bahasa Indonesia, carrying the pocket
 * code and the join link and nothing else — no attachment, no financial data.
 */

const INVITE = { to: "partner@example.com", code: "4821kPz7xQ", joinUrl: "https://sahfund.test/join?code=4821kPz7xQ" };
const CONFIG = { apiKey: "re_test", from: "SahFund <invite@sahfund.test>" };

test("the message is text-only and carries the code and the join link", () => {
  const { subject, text } = inviteEmail(INVITE);

  assert.equal(typeof text, "string");
  assert.match(text, /4821kPz7xQ/);
  assert.match(text, /https:\/\/sahfund\.test\/join\?code=4821kPz7xQ/);
  // No financial data of any kind, and no markup.
  assert.doesNotMatch(text, /Rp|rupiah|saldo|anggaran|\d{1,3}(\.\d{3})+/i);
  assert.doesNotMatch(text, /<[a-z]/i);
  assert.match(subject, /SahFund/);
});

test("sends exactly one text-only message through Resend", async () => {
  const calls: { url: string; init: RequestInit }[] = [];
  const fetchImpl = (async (url: string, init: RequestInit) => {
    calls.push({ url, init });
    return new Response(JSON.stringify({ id: "email-1" }), { status: 200 });
  }) as unknown as typeof fetch;

  const result = await sendInviteEmail(INVITE, CONFIG, fetchImpl);

  assert.deepEqual(result, { ok: true });
  assert.equal(calls.length, 1);
  assert.equal(calls[0].url, "https://api.resend.com/emails");
  assert.equal(calls[0].init.method, "POST");
  assert.equal((calls[0].init.headers as Record<string, string>).authorization, "Bearer re_test");

  const body = JSON.parse(String(calls[0].init.body)) as Record<string, unknown>;
  assert.equal(body.from, CONFIG.from);
  assert.deepEqual(body.to, [INVITE.to]);
  assert.equal(typeof body.text, "string");
  assert.equal(body.html, undefined);
  assert.equal(body.attachments, undefined);
});

test("a missing key or sender is a typed 'not-configured', not a throw", async () => {
  let called = false;
  const fetchImpl = (async () => {
    called = true;
    return new Response("{}", { status: 200 });
  }) as unknown as typeof fetch;

  assert.deepEqual(await sendInviteEmail(INVITE, {}, fetchImpl), { ok: false, reason: "not-configured" });
  assert.deepEqual(await sendInviteEmail(INVITE, { apiKey: "re_test" }, fetchImpl), {
    ok: false,
    reason: "not-configured",
  });
  assert.equal(called, false, "no request is attempted without credentials");
});

test("a non-2xx answer is 'rejected' with the status, so the route can log it", async () => {
  const fetchImpl = (async () => new Response("nope", { status: 422 })) as unknown as typeof fetch;
  assert.deepEqual(await sendInviteEmail(INVITE, CONFIG, fetchImpl), {
    ok: false,
    reason: "rejected",
    status: 422,
  });
});

test("a network failure is 'network', never an exception reaching the handler", async () => {
  const fetchImpl = (async () => {
    throw new TypeError("fetch failed");
  }) as unknown as typeof fetch;

  assert.deepEqual(await sendInviteEmail(INVITE, CONFIG, fetchImpl), { ok: false, reason: "network" });
});
