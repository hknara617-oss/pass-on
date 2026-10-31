import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createClient as createAdminClient } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/server";
import { DEVICE_COOKIE, DEVICE_MAX_AGE, deviceConfig, issueDevice, readDevice, safeDeviceNext, validBootstrap } from "@/lib/device-security";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
const headers = { "Cache-Control": "private, no-store, max-age=0", "Referrer-Policy": "no-referrer", "X-Robots-Tag": "noindex, nofollow" };
const json = (body: object, status = 200) => NextResponse.json(body, { status, headers });
function sameOrigin(request: Request) {
  return request.headers.get("origin") === new URL(request.url).origin && request.headers.get("sec-fetch-site") !== "cross-site";
}
async function smallBody(request: Request): Promise<Record<string, unknown>> {
  if (!request.headers.get("content-type")?.startsWith("application/json")) throw new Error("content-type");
  const reader = request.body?.getReader();
  if (!reader) return {};
  let length = 0;
  const chunks: Uint8Array[] = [];
  for (;;) {
    const { value, done } = await reader.read();
    if (done) break;
    length += value.length;
    if (length > 2048) { await reader.cancel(); throw new Error("body-too-large"); }
    chunks.push(value);
  }
  const value: unknown = JSON.parse(Buffer.concat(chunks).toString("utf8"));
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error("body");
  return value as Record<string, unknown>;
}
export async function POST(request: NextRequest) {
  if (!sameOrigin(request)) return json({ error: "이 앱 안에서 다시 시도해 주세요." }, 403);
  let body: Record<string, unknown>;
  try { body = await smallBody(request); } catch { return json({ error: "연결 요청을 확인하지 못했습니다." }, 400); }
  try {
    const { owner } = deviceConfig();
    const linked = readDevice(request.cookies.get(DEVICE_COOKIE)?.value);
    if (!linked && !validBootstrap(body.setup)) return json({ error: "개인 연결 링크로 이 기기를 먼저 연결해 주세요. 비밀번호는 필요하지 않습니다." }, 403);
    const client = await createClient();
    const current = await client.auth.getUser();
    if (current.data.user?.id !== owner) {
      const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
      const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
      if (!url || !key) throw new Error("Missing server configuration");
      // Resume only the existing server-pinned account. Never change data ownership.
      const admin = createAdminClient(url, key, { auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false } });
      const account = await admin.auth.admin.getUserById(owner);
      if (account.error || account.data.user?.id !== owner || !account.data.user.email) throw new Error("Owner unavailable");
      const link = await admin.auth.admin.generateLink({ type: "magiclink", email: account.data.user.email });
      if (link.error || link.data.user?.id !== owner || !link.data.properties?.hashed_token) throw new Error("Session unavailable");
      const verified = await client.auth.verifyOtp({ token_hash: link.data.properties.hashed_token, type: "email" });
      if (verified.error || verified.data.user?.id !== owner) throw new Error("Session verification failed");
    }
    const response = json({ ok: true, next: safeDeviceNext(body.next) });
    response.cookies.set(DEVICE_COOKIE, issueDevice(), { httpOnly: true, secure: true, sameSite: "lax", path: "/", maxAge: DEVICE_MAX_AGE });
    return response;
  } catch {
    // Do not log credentials, private recovery links, or user records.
    return json({ error: "기록 서버에 잠시 연결하지 못했습니다. 기존 기록은 그대로입니다. 다시 연결해 주세요." }, 503);
  }
}
export async function DELETE(request: NextRequest) {
  if (!sameOrigin(request)) return json({ error: "Invalid origin" }, 403);
  const client = await createClient();
  try { await client.auth.signOut({ scope: "local" }); } catch { /* Still remove this device's access. */ }
  const jar = await cookies();
  const ref = new URL(process.env.NEXT_PUBLIC_SUPABASE_URL!).hostname.split(".")[0];
  for (const c of jar.getAll()) {
    if (c.name === `sb-${ref}-auth-token` || c.name.startsWith(`sb-${ref}-auth-token.`)) jar.delete(c.name);
  }
  const response = json({ ok: true });
  response.cookies.set(DEVICE_COOKIE, "", { httpOnly: true, secure: true, sameSite: "lax", path: "/", maxAge: 0 });
  return response;
}
