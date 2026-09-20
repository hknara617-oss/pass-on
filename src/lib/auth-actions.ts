import type { SupabaseClient } from "@supabase/supabase-js";
import { passwordError } from "./auth";

export async function requestRecovery(
  client: SupabaseClient,
  email: string,
  origin: string,
) {
  const target = new URL(origin);
  if (
    target.protocol !== "https:" &&
    !["localhost", "127.0.0.1"].includes(target.hostname)
  )
    throw new Error("Insecure recovery origin");
  return client.auth.resetPasswordForEmail(email.trim(), {
    redirectTo: `${target.origin}/auth/recovery`,
  });
}
export async function changePassword(
  client: SupabaseClient,
  expectedId: string,
  password: string,
  confirmation: string,
  nonce?: string,
) {
  const invalid = passwordError(password, confirmation);
  if (invalid) throw new Error(invalid);
  const current = await client.auth.getUser();
  if (!expectedId || current.error || current.data.user?.id !== expectedId)
    throw new Error("로그인 계정이 변경되었습니다. 페이지를 다시 열어 주세요.");
  return client.auth.updateUser({
    password,
    ...(nonce ? { nonce: nonce.trim() } : {}),
  });
}
