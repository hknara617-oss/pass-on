import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { safeNext } from "@/lib/auth";

export async function GET(request: NextRequest) {
  const code = request.nextUrl.searchParams.get("code");
  if (code) {
    const { error } = await (
      await createClient()
    ).auth.exchangeCodeForSession(code);
    if (!error) {
      const next = safeNext(
        request.nextUrl.searchParams.get("next") || "/auth/update-password",
      );
      const response = NextResponse.redirect(new URL(next, request.url));
      response.headers.set("Cache-Control", "private, no-store");
      return response;
    }
  }
  return NextResponse.redirect(new URL("/auth/error", request.url));
}
