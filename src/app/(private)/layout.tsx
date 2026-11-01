import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { cookies } from "next/headers";
import { DEVICE_COOKIE, readDevice } from "@/lib/device-security";
import { AppNav } from "@/components/app-nav";
import { Brand } from "@/components/brand";
import { Icon } from "@/components/icons";
export const dynamic = "force-dynamic";
export default async function Layout({children}:{children:React.ReactNode}) {
  const device = readDevice((await cookies()).get(DEVICE_COOKIE)?.value);
  if (!device) redirect("/device");
  const {data,error} = await (await createClient()).auth.getUser();
  if (error && error.status && error.status >= 500) throw new Error("Authentication service unavailable");
  if (!data.user || data.user.id !== device.owner) redirect("/device");
  return <><a className="skip-link" href="#main-content">본문으로 이동</a><main className="app quiet-app" id="main-content"><header className="signature-header"><Brand/><Link className="privacy-chip" href="/data" prefetch={false}><Icon name="shield" size={14}/><span>나만의 공간</span></Link></header>{children}</main><AppNav/></>;
}
