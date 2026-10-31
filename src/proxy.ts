import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { publicConfig } from "./lib/supabase/config";
import { DEVICE_COOKIE, readDevice } from "./lib/device-security";
export async function proxy(request: NextRequest) {
  let response = NextResponse.next({ request });
  const reconnect = () => {
    const target = new URL("/device", request.url);
    target.searchParams.set("next", request.nextUrl.pathname);
    const redirect = NextResponse.redirect(target);
    response.cookies.getAll().forEach(c => redirect.cookies.set(c));
    redirect.headers.set("Cache-Control", "private, no-store, max-age=0");
    return redirect;
  };
  const device = readDevice(request.cookies.get(DEVICE_COOKIE)?.value);
  if (!device) return reconnect();
  const { url, key } = publicConfig();
  const client = createServerClient(url, key, {
    cookies: {
      getAll: () => request.cookies.getAll(),
      setAll: values => {
        values.forEach(({ name, value }) => request.cookies.set(name, value));
        response = NextResponse.next({ request });
        values.forEach(({ name, value, options }) => response.cookies.set(name, value, options));
      },
    },
  });
  const { data } = await client.auth.getUser();
  if (data.user?.id !== device.owner) return reconnect();
  response.headers.set("Cache-Control", "private, no-store, max-age=0");
  return response;
}
export const config = { matcher: ["/capture/:path*", "/archive/:path*", "/data/:path*", "/revisit/:path*"] };
