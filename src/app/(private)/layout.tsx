import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { AppNav } from "@/components/app-nav";
export const dynamic = "force-dynamic";
export default async function Layout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { data, error } = await (await createClient()).auth.getUser();
  if (error && error.status && error.status >= 500)
    throw new Error("Authentication service unavailable");
  if (!data.user) redirect("/login");
  return (
    <>
      <main className="app">
        <header className="top">
          <div className="brand">PASS ON</div>
        </header>
        {children}
      </main>
      <AppNav />
    </>
  );
}
