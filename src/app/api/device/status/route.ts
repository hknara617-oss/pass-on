import { NextRequest, NextResponse } from "next/server";
import { DEVICE_COOKIE, readDevice } from "@/lib/device-security";
import { createClient } from "@/lib/supabase/server";
export const dynamic = "force-dynamic";
export const runtime = "nodejs";
const headers = { "Cache-Control": "private, no-store, max-age=0", "X-Robots-Tag": "noindex, nofollow" };
export async function GET(request: NextRequest) {
  const device = readDevice(request.cookies.get(DEVICE_COOKIE)?.value);
  if (!device) return NextResponse.json({ connected: false }, { status: 401, headers });
  try {
    const { data, error } = await (await createClient()).auth.getUser();
    const connected = !error && data.user?.id === device.owner;
    return NextResponse.json({ connected }, { status: connected ? 200 : 401, headers });
  } catch {
    return NextResponse.json({ connected: false }, { status: 503, headers });
  }
}
