import { redirect } from "next/navigation";
export default async function Home({
  searchParams,
}: {
  searchParams: Promise<{ code?: string }>;
}) {
  const { code } = await searchParams;
  // Preserve a recovery code if Supabase falls back to the site's root URL.
  redirect(
    code ? `/auth/callback?code=${encodeURIComponent(code)}` : "/capture",
  );
}
