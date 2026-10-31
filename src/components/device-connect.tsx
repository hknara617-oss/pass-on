"use client";
import { useEffect, useRef, useState } from "react";
import { AuthFrame, Status } from "./auth-ui";
export function DeviceConnect() {
  const started = useRef(false), setup = useRef<string | null>(null), next = useRef("/capture");
  const [busy, setBusy] = useState(true), [ready, setReady] = useState(false), [error, setError] = useState("");
  async function connect() {
    setBusy(true); setError("");
    try {
      const response = await fetch("/api/device", {
        method: "POST", credentials: "same-origin", cache: "no-store",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ setup: setup.current, next: next.current }),
        signal: AbortSignal.timeout(30000),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "연결하지 못했습니다. 다시 시도해 주세요.");
      if (!setup.current) { location.replace(result.next || "/capture"); return; }
      setup.current = null;
      setReady(true);
    } catch (e) { setError(e instanceof Error && e.name !== "TimeoutError" ? e.message : "연결이 지연되고 있습니다. 다시 연결해 주세요."); }
    finally { setBusy(false); }
  }
  useEffect(() => {
    if (started.current) return;
    started.current = true;
    const params = new URLSearchParams(location.search);
    const target = params.get("next");
    if (target && /^\/(capture|archive|revisit|data)$/.test(target)) next.current = target;
    setup.current = new URLSearchParams(location.hash.slice(1)).get("setup");
    if (location.hash) history.replaceState(null, "", location.pathname + location.search);
    if (params.has("disconnected")) { setBusy(false); return; }
    void connect();
  }, []);
  return <AuthFrame title={ready ? <>이제, 바로 남기세요.</> : <>나만의 PASS ON</>}
    description={ready ? "이 기기를 연결했어요. 다음부터 이메일·비밀번호 없이 열립니다." : "나와 아이의 기록. 연결한 기기에서만 열립니다."}>
    <div className="card">
      {ready ? <>
        <h2>아이폰 홈 화면에 두기</h2>
        <p>Safari로 연 뒤 <strong>공유 ↑ → 홈 화면에 추가 → 추가</strong>를 눌러 주세요.</p>
        <p className="hint">홈 화면의 PASS ON을 누르면 바로 남기기 화면이 열립니다. 이미 열린 앱이 따로 있다면, 이 연결을 마친 Safari에서 새 아이콘을 추가해 주세요.</p>
        <a className="primary centered" href="/capture">바로 남기기</a>
      </> : <>
        <p>{busy ? "개인 기기를 연결하고 있습니다…" : "처음 한 번 개인 연결 링크를 열면, 이후에는 홈 화면에서 바로 사용할 수 있어요."}</p>
        <Status error={error} />
        <button className="primary" disabled={busy} onClick={() => void connect()}>{busy ? "연결 중…" : "다시 연결"}</button>
      </>}
    </div>
    <p className="hint centered">기존 글·사진·목소리는 원래 저장소에 그대로 보관됩니다.<br />개인 연결 링크는 다른 사람에게 공유하지 마세요.</p>
  </AuthFrame>;
}
