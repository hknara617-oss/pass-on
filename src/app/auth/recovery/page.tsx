"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { AuthFrame, Status } from "@/components/auth-ui";

// Supabase's default recovery email arrives here with an implicit-flow fragment.
// The browser client exchanges it for a cookie session; no URL token is persisted.
export default function RecoveryCallbackPage() {
  const router = useRouter();
  const [message, setMessage] = useState("이메일 소유권을 확인하고 있습니다...");

  useEffect(() => {
    const client = createClient();
    let active = true;
    const finish = async () => {
      const { data, error } = await client.auth.getSession();
      if (!active) return;
      if (error || !data.session) {
        setMessage("링크가 만료되었거나 이미 사용되었습니다. 다시 요청해 주세요.");
        return;
      }
      // The fragment is never sent to the server, but removing it prevents reuse
      // through browser history once Supabase has exchanged it for the session.
      window.history.replaceState({}, document.title, "/auth/recovery");
      router.replace("/auth/update-password");
    };
    void finish();
    const { data: listener } = client.auth.onAuthStateChange((event, session) => {
      if (event === "PASSWORD_RECOVERY" && session && active) {
        window.history.replaceState({}, document.title, "/auth/recovery");
        router.replace("/auth/update-password");
      }
    });
    return () => {
      active = false;
      listener.subscription.unsubscribe();
    };
  }, [router]);

  return (
    <AuthFrame title="이메일 확인" description="PASS ON 계정을 안전하게 복구합니다.">
      <div className="card auth-card"><Status message={message} /></div>
    </AuthFrame>
  );
}
