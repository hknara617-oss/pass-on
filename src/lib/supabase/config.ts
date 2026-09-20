export function publicConfig() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key)
    throw new Error("Supabase public configuration is missing.");
  if (key.startsWith("sb_secret_"))
    throw new Error("A secret key must never be used by this app.");
  if (key.split(".").length === 3) {
    const payload = JSON.parse(
      atob(key.split(".")[1].replace(/-/g, "+").replace(/_/g, "/")),
    );
    if (payload.role !== "anon")
      throw new Error("Only a public anon key is allowed.");
  }
  return { url, key };
}
