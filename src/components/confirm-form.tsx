"use client";
import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { authError } from "@/lib/auth";
import { AuthFrame, LoginLink, Status } from "./auth-ui";
import Link from "next/link";

export function ConfirmForm() {
  const [token, setToken] = useState("");
  const [type, setType] = useState<"recovery" | "signup" | null>(null);
  const [ready, setReady] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const router = useRouter();
  const captured = useRef(false);
  useEffect(() => {
    if (captured.current) return;
    captured.current = true;
    const query = new URLSearchParams(location.search);
    setToken(query.get("token_hash") || "");
    const value = query.get("type");
    setType(value === "recovery" || value === "signup" ? value : null);
    history.replaceState(null, "", "/auth/confirm");
    setReady(true);
  }, []);
  async function verify() {
    if (busy || !token || !type) return;
    setBusy(true);
    setError("");
    try {
      const result = await createClient().auth.verifyOtp({
        token_hash: token,
        type,
      });
      if (result.error) {
        setError(authError(result.error));
        return;
      }
      setToken("");
      router.replace(
        type === "recovery" ? "/auth/update-password" : "/capture",
      );
      router.refresh();
    } catch {
      setError("연결을 확인한 뒤 다시 시도해 주세요.");
    } finally {
      setBusy(false);
    }
  }
  return (
    <AuthFrame
      title="이메일 확인"
      description="아래 버튼을 눌러 PASS ON으로 돌아오세요."
    >
      {!ready ? (
        <p role="status">확인 중...</p>
      ) : token && type ? (
        <button className="primary" disabled={busy} onClick={verify}>
          {busy
            ? "확인 중..."
            : type === "recovery"
              ? "확인하고 새 비밀번호 설정"
              : "확인하고 시작하기"}
        </button>
      ) : (
        <p role="alert">인증 링크를 다시 열거나 새 링크를 받아 주세요.</p>
      )}
      <Status error={error} />
      <Link className="text-link centered" href="/forgot-password">
        새 인증 링크 받기
      </Link>
      <LoginLink />
    </AuthFrame>
  );
}
