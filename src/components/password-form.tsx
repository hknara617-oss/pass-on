"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { authError, passwordError } from "@/lib/auth";
import { changePassword } from "@/lib/auth-actions";
import { AuthFrame, Status } from "./auth-ui";

export function PasswordForm({ recovery = false }: { recovery?: boolean }) {
  const [ready, setReady] = useState(false),
    [userId, setUserId] = useState(""),
    [email, setEmail] = useState("");
  const [password, setPassword] = useState(""),
    [confirm, setConfirm] = useState(""),
    [nonce, setNonce] = useState("");
  const [needNonce, setNeedNonce] = useState(false),
    [nonceSent, setNonceSent] = useState(false);
  const [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [done, setDone] = useState(false);
  useEffect(() => {
    let active = true;
    createClient()
      .auth.getUser()
      .then(({ data, error }) => {
        if (active) {
          setUserId(error ? "" : data.user?.id || "");
          setEmail(data.user?.email || "");
          setReady(true);
        }
      })
      .catch(() => {
        if (active) {
          setReady(true);
          setError("계정을 확인하지 못했습니다. 잠시 후 다시 시도해 주세요.");
        }
      });
    return () => {
      active = false;
    };
  }, []);
  async function reauthenticate() {
    if (busy) return;
    setBusy(true);
    setError("");
    try {
      const { error } = await createClient().auth.reauthenticate();
      if (error) setError(authError(error));
      else setNonceSent(true);
    } catch {
      setError("연결을 확인한 뒤 다시 시도해 주세요.");
    } finally {
      setBusy(false);
    }
  }
  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (busy || !userId) return;
    const invalid = passwordError(password, confirm);
    if (invalid) {
      setError(invalid);
      return;
    }
    setBusy(true);
    setError("");
    try {
      const client = createClient();
      // Revalidate account before a sensitive operation; never trust a URL user id.
      const result = await changePassword(
        client,
        userId,
        password,
        confirm,
        needNonce ? nonce : undefined,
      );
      if (result.error) {
        if (result.error.code === "reauthentication_needed") setNeedNonce(true);
        setError(authError(result.error));
        return;
      }
      if (result.data.user?.id !== userId) {
        setError("계정을 확인하지 못했습니다. 다시 로그인해 확인해 주세요.");
        return;
      }
      setPassword("");
      setConfirm("");
      setNonce("");
      setDone(true);
      // Do not sign out automatically. Never call global signOut.
    } catch {
      setError(
        "응답을 확인하지 못했습니다. 비밀번호 찾기에서 다시 확인해 주세요.",
      );
    } finally {
      setBusy(false);
    }
  }
  return (
    <AuthFrame
      title={recovery ? "새 비밀번호 설정" : "비밀번호 변경"}
      description={email || "이메일 확인 또는 로그인이 필요합니다."}
    >
      {!ready ? (
        <p role="status">계정을 확인하고 있습니다...</p>
      ) : !userId ? (
        <>
          <p>본인 확인 후 비밀번호를 설정할 수 있습니다.</p>
          <Link className="primary block" href="/forgot-password">
            이메일로 본인 확인
          </Link>
        </>
      ) : done ? (
        <>
          <Status message="새 비밀번호를 저장했습니다. 기존 계정으로 계속 이용할 수 있습니다." />
          <Link className="primary block" href="/archive">
            내가 남긴 것 보기
          </Link>
        </>
      ) : (
        <form onSubmit={submit}>
          <div className="card auth-card">
            <label htmlFor="new-password">새 비밀번호</label>
            <input
              id="new-password"
              type="password"
              autoComplete="new-password"
              required
              minLength={12}
              maxLength={128}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              aria-describedby="password-hint"
            />
            <p className="hint" id="password-hint">
              12자 이상. 다른 곳에서 사용하지 않는 비밀번호를 권합니다.
            </p>
            <label htmlFor="confirm-password">새 비밀번호 확인</label>
            <input
              id="confirm-password"
              type="password"
              autoComplete="new-password"
              required
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
            />
            {needNonce && (
              <>
                <button
                  className="secondary"
                  type="button"
                  onClick={reauthenticate}
                  disabled={busy || nonceSent}
                >
                  {nonceSent
                    ? "인증번호를 보냈습니다"
                    : "이메일로 인증번호 받기"}
                </button>
                <label htmlFor="nonce">이메일 인증번호</label>
                <input
                  id="nonce"
                  autoComplete="one-time-code"
                  inputMode="numeric"
                  required
                  value={nonce}
                  onChange={(e) => setNonce(e.target.value)}
                />
              </>
            )}
            <Status error={error} />
            <p className="hint">
              비밀번호 변경 후 다른 기기에서 다시 로그인해야 할 수 있습니다.
            </p>
          </div>
          <button className="primary" disabled={busy}>
            {busy ? "저장 중..." : "새 비밀번호 저장"}
          </button>
        </form>
      )}
      <Link className="text-link centered" href={recovery ? "/login" : "/data"}>
        {recovery ? "로그인으로 돌아가기" : "내 데이터로 돌아가기"}
      </Link>
    </AuthFrame>
  );
}
