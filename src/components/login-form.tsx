"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { authError, safeNext } from "@/lib/auth";
import { AuthFrame, Status } from "./auth-ui";

export function LoginForm({ next }: { next?: string }) {
  const router = useRouter();
  const [signup, setSignup] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (busy) return;
    setBusy(true);
    setError("");
    setMessage("");
    try {
      if (signup) {
        const response = await fetch("/api/auth/register", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ email: email.trim(), password }),
        });
        if (!response.ok) {
          setError(
            "가입 요청을 처리하지 못했습니다. 이미 가입했다면 비밀번호 찾기를 이용해 주세요.",
          );
          return;
        }
        setMessage(
          "확인 메일을 보냈습니다. 이메일의 링크로 계정을 확인한 뒤 로그인해 주세요.",
        );
        setPassword("");
        return;
      }
      const result = await createClient().auth.signInWithPassword({
        email: email.trim(),
        password,
      });
      if (result.error) {
        setError(authError(result.error));
        return;
      }
      setPassword("");
      router.replace(safeNext(next));
      router.refresh();
    } catch {
      setError("연결을 확인한 뒤 다시 시도해 주세요.");
    } finally {
      setBusy(false);
    }
  }
  return (
    <AuthFrame
      title={
        <>
          아이에게,
          <br />
          지금의 당신을.
        </>
      }
      description={
        signup
          ? "이메일 확인 후 비밀번호로 시작하세요."
          : "당신과 아이만의 조용한 기록 공간"
      }
    >
      <form onSubmit={submit}>
        <div className="card auth-card">
          <label htmlFor="email">이메일</label>
          <input
            id="email"
            type="email"
            autoComplete="email"
            placeholder="name@example.com"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
          <label htmlFor="password">비밀번호</label>
          <input
            id="password"
            type="password"
            autoComplete={signup ? "new-password" : "current-password"}
            placeholder={signup ? "12자 이상 비밀번호" : "비밀번호"}
            required
            minLength={signup ? 12 : 1}
            maxLength={128}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
          <Status error={error} message={message} />
        </div>
        <button
          className="primary"
          disabled={busy || !email.trim() || !password}
        >
          {busy
            ? "처리 중..."
            : signup
              ? "비밀번호 설정하고 시작하기"
              : "로그인"}
        </button>
      </form>
      <Link className="text-link centered" href="/forgot-password">
        비밀번호를 잊으셨나요?
      </Link>
      <button
        className="text-link centered"
        onClick={() => {
          setSignup(!signup);
          setError("");
          setMessage("");
          setPassword("");
        }}
      >
        {signup
          ? "이미 계정이 있으신가요? (로그인)"
          : "처음이신가요? (비밀번호 설정하고 시작)"}
      </button>
    </AuthFrame>
  );
}
