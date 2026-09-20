import test from "node:test";
import assert from "node:assert/strict";
import { safeNext, passwordError, authError } from "../src/lib/auth";
import { requestRecovery, changePassword } from "../src/lib/auth-actions";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

test("redirects stay on known application paths", () => {
  for (const x of [
    "https://attacker.invalid",
    "//attacker.invalid",
    "/\\attacker.invalid",
    "/archive?next=evil",
    "javascript:alert(1)",
    null,
    undefined,
  ])
    assert.equal(safeNext(x), "/capture");
  assert.equal(safeNext("/archive"), "/archive");
  assert.equal(safeNext("/auth/update-password"), "/auth/update-password");
});
test("new passwords must be long, bounded, and match", () => {
  assert.ok(passwordError("short", "short"));
  assert.ok(passwordError("a".repeat(129), "a".repeat(129)));
  assert.ok(passwordError("longer-password", "different-password"));
  assert.equal(passwordError("longer-password", "longer-password"), null);
});
test("authentication failures are translated without leaking email/account details", () => {
  assert.match(authError({ code: "invalid_credentials" }), /비밀번호/);
  assert.match(authError({ code: "otp_expired" }), /만료/);
  assert.match(
    authError({ message: "private email and internal database details" }),
    /요청을 처리하지/,
  );
});
test("real SDK recovery request calls recover only, carries PKCE, never calls signup or logout", async () => {
  const requests: { url: string; body: Record<string, unknown> }[] = [];
  const client = createClient(
    "https://example.supabase.co",
    "sb_publishable_test",
    {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
        detectSessionInUrl: false,
        flowType: "pkce",
      },
      global: {
        fetch: async (input, init) => {
          requests.push({
            url: String(input),
            body: JSON.parse(String(init?.body)),
          });
          return new Response("{}", {
            status: 200,
            headers: { "content-type": "application/json" },
          });
        },
      },
    },
  );
  const result = await requestRecovery(
    client,
    " parent@example.test ",
    "https://pass-on-jet.vercel.app",
  );
  assert.equal(result.error, null);
  assert.equal(requests.length, 1);
  assert.match(requests[0].url, /\/auth\/v1\/recover\?/);
  assert.equal(requests[0].body.email, "parent@example.test");
  assert.ok(requests[0].body.code_challenge);
  assert.equal(
    new URL(requests[0].url).searchParams.get("redirect_to"),
    "https://pass-on-jet.vercel.app/auth/recovery",
  );
});
test("email recovery refuses an insecure remote origin", async () => {
  await assert.rejects(
    () =>
      requestRecovery(
        {} as SupabaseClient,
        "parent@example.test",
        "http://attacker.invalid",
      ),
    /Insecure/,
  );
});
test("password change verifies the same UUID and only calls updateUser", async () => {
  const calls: unknown[] = [];
  const client = {
    auth: {
      getUser: async () => ({
        data: { user: { id: "existing-id" } },
        error: null,
      }),
      updateUser: async (payload: unknown) => {
        calls.push(payload);
        return { data: { user: { id: "existing-id" } }, error: null };
      },
    },
  } as unknown as SupabaseClient;
  const result = await changePassword(
    client,
    "existing-id",
    "new-long-password",
    "new-long-password",
  );
  assert.equal(result.data.user?.id, "existing-id");
  assert.deepEqual(calls, [{ password: "new-long-password" }]);
});
test("password change fails closed on missing or changed identity", async () => {
  for (const id of [null, "different-id"]) {
    let called = false;
    const client = {
      auth: {
        getUser: async () => ({
          data: { user: id ? { id } : null },
          error: null,
        }),
        updateUser: () => {
          called = true;
        },
      },
    } as unknown as SupabaseClient;
    await assert.rejects(
      () =>
        changePassword(
          client,
          "existing-id",
          "new-long-password",
          "new-long-password",
        ),
      /계정/,
    );
    assert.equal(called, false);
  }
});
test("password change does not call auth if confirmation does not match", async () => {
  await assert.rejects(
    () =>
      changePassword(
        {} as SupabaseClient,
        "existing-id",
        "new-long-password",
        "other-long-password",
      ),
    /일치/,
  );
});
test("reauthentication nonce is forwarded only with the password", async () => {
  let sent: unknown;
  const client = {
    auth: {
      getUser: async () => ({
        data: { user: { id: "existing-id" } },
        error: null,
      }),
      updateUser: async (payload: unknown) => {
        sent = payload;
        return { data: { user: { id: "existing-id" } }, error: null };
      },
    },
  } as unknown as SupabaseClient;
  await changePassword(
    client,
    "existing-id",
    "new-long-password",
    "new-long-password",
    " 123456 ",
  );
  assert.deepEqual(sent, { password: "new-long-password", nonce: "123456" });
});
