"use client";
import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { authError, RECOVERY_MESSAGE } from "@/lib/auth";
import { requestRecovery } from "@/lib/auth-actions";
import { AuthFrame, LoginLink, Status } from "./auth-ui";

export function RecoveryForm() {
  const [email, setEmail] = useState("");
  const [busy, setBusy] = useState(false);
  const [wait, setWait] = useState(0);
  const [error, setError] = useState("");
  const [sent, setSent] = useState(false);
  useEffect(() => {
    if (!wait) return;
    const timer = setTimeout(() => setWait(wait - 1), 1000);
    return () => clearTimeout(timer);
  }, [wait]);
  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (busy || wait) return;
    setBusy(true);
    setError("");
    setSent(false);
    try {
      // Recovery never calls signUp or an admin endpoint and never signs out.
      const result = await requestRecovery(
        createClient(),
        email,
        window.location.origin,
      );
      if (
        result.error &&
        !["user_not_found", "email_not_found"].includes(result.error.code || "")
      ) {
        setError(authError(result.error));
        return;
      }
      setSent(true);
      setWait(60);
    } catch {
      setError("연결을 확인한 뒤 다시 시도해 주세요.");
    } finally {
      setBusy(false);
    }
  }
  return (
    <AuthFrame
      title="비밀번호 찾기"
      description="가입한 이메일로 본인을 확인하고 새 비밀번호를 설정하세요."
    >
      <form onSubmit={submit}>
        <div className="card auth-card">
          <label htmlFor="email">가입한 이메일</label>
          <input
            id="email"
            type="email"
            autoComplete="email"
            placeholder="name@example.com"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
          <Status error={error} message={sent ? RECOVERY_MESSAGE : undefined} />
        </div>
        <button
          className="primary"
          disabled={busy || wait > 0 || !email.trim()}
        >
          {busy
            ? "요청 중..."
            : wait > 0
              ? `${wait}초 후 다시 보내기`
              : sent
                ? "인증 메일 다시 보내기"
                : "인증 메일 받기"}
        </button>
      </form>
      <LoginLink />
    </AuthFrame>
  );
}
