import { createClient } from "@/lib/supabase/server";
export async function POST(request: Request) {
  const origin = new URL(request.url).origin;
  if (request.headers.get("origin") !== origin)
    return Response.json({ error: "Invalid origin" }, { status: 403 });
  if (Number(request.headers.get("content-length") || 0) > 8192)
    return Response.json({ error: "Invalid request" }, { status: 413 });
  let body: { email?: unknown; password?: unknown };
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Invalid request" }, { status: 400 });
  }
  if (
    typeof body.email !== "string" ||
    typeof body.password !== "string" ||
    body.email.length > 254 ||
    !body.email.includes("@") ||
    body.password.length < 12 ||
    body.password.length > 128
  )
    return Response.json({ error: "Invalid request" }, { status: 400 });
  const { error } = await (
    await createClient()
  ).auth.signUp({
    email: body.email.trim(),
    password: body.password,
    options: { emailRedirectTo: `${origin}/auth/callback?next=/capture` },
  });
  if (error)
    return Response.json(
      { error: "가입 요청을 처리하지 못했습니다." },
      { status: error.status === 429 ? 429 : 400 },
    );
  return Response.json(
    { message: "이메일을 확인해 주세요." },
    { headers: { "Cache-Control": "no-store" } },
  );
}
