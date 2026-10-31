import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { cookies } from "next/headers";
import { DEVICE_COOKIE, readDevice } from "@/lib/device-security";
import { AppNav } from "@/components/app-nav";
export const dynamic = "force-dynamic";
export default async function Layout({
  children,
}: {
  children: React.ReactNode;
}) {
  const device = readDevice((await cookies()).get(DEVICE_COOKIE)?.value);
  if (!device) redirect("/device");
  const { data, error } = await (await createClient()).auth.getUser();
  if (error && error.status && error.status >= 500)
    throw new Error("Authentication service unavailable");
  if (!data.user || data.user.id !== device.owner) redirect("/device");
  return (
    <>
      <main className="app">
        <header className="top">
          <div className="brand">PASS ON <span style={{fontSize:10,letterSpacing:1}}>PERSONAL</span></div>
        </header>
        <details className="hint" style={{marginBottom:16}}><summary>홈 화면에서 바로 열기</summary><p>Safari 공유 ↑ → 홈 화면에 추가. 연결한 기기에서는 로그인 입력 없이 열립니다. 기기 잠금은 꼭 설정해 주세요.</p></details>
        {children}
      </main>
      <AppNav />
    </>
  );
}
