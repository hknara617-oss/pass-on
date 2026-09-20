import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { publicConfig } from "./lib/supabase/config";

export async function proxy(request: NextRequest) {
  let response = NextResponse.next({ request });
  const { url, key } = publicConfig();
  const client = createServerClient(url, key, {
    cookies: {
      getAll: () => request.cookies.getAll(),
      setAll: (values) => {
        values.forEach(({ name, value }) => request.cookies.set(name, value));
        response = NextResponse.next({ request });
        values.forEach(({ name, value, options }) =>
          response.cookies.set(name, value, options),
        );
      },
    },
  });
  // Validate/refresh cookies. No custom token, session reset, or admin auth.
  await client.auth.getUser();
  response.headers.set("Cache-Control", "private, no-store, max-age=0");
  return response;
}
export const config = {
  matcher: [
    "/capture/:path*",
    "/archive/:path*",
    "/data/:path*",
    "/revisit/:path*",
  ],
};
