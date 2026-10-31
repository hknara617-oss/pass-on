"use client";
import { useEffect, useRef, useState } from "react";
import { AuthFrame, Status } from "./auth-ui";
import { deviceNext, parseDeviceLink } from "@/lib/device-link";
export function DeviceConnect() {
  const started = useRef(false), pending = useRef(false), setup = useRef<string | null>(null);
  const next = useRef("/capture"), installed = useRef(false), input = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(true), [ready, setReady] = useState(false);
  const [standalone, setStandalone] = useState(false), [value, setValue] = useState("");
  const [error, setError] = useState(""), [message, setMessage] = useState("");
  async function connect(token: string | null, explicit = false) {
    if (pending.current) return;
    pending.current = true;
    setBusy(true); setError(""); setMessage("");
    try {
      const response = await fetch("/api/device", {
        method: "POST", credentials: "same-origin", cache: "no-store",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ setup: token, next: next.current }),
        signal: AbortSignal.timeout(30000),
      });
      if (response.status === 403) {
        if (explicit) setError("연결 링크가 만료되었거나 올바르지 않습니다. 가장 최근에 받은 개인 연결 링크를 복사해 주세요.");
        return;
      }
      if (!response.ok) throw new Error("server");
      const result = await response.json();
      // A successful POST is not enough: confirm the cookie in THIS storage context.
      const status = await fetch("/api/device/status", {
        credentials: "same-origin", cache: "no-store", signal: AbortSignal.timeout(15000),
      });
      if (!status.ok || !(await status.json()).connected) {
        setError("이 앱에 연결 정보를 저장하지 못했습니다. 쿠키 차단 여부를 확인하고, 이 화면에서 다시 연결해 주세요.");
        return;
      }
      setValue("");
      if (installed.current || !token) {
        setup.current = null;
        location.replace(deviceNext(result.next));
        return;
      }
      setup.current = token;
      setReady(true);
    } catch {
      setError(navigator.onLine === false
        ? "인터넷 연결이 끊겼습니다. 다시 연결한 뒤 시도해 주세요. 기존 기록은 그대로입니다."
        : "지금 연결을 확인하지 못했습니다. 잠시 후 다시 연결해 주세요. 기존 기록은 그대로입니다.");
    } finally { pending.current = false; setBusy(false); }
  }
  function useLink(raw: string) {
    if (pending.current) return;
    const token = parseDeviceLink(raw, location.origin);
    if (!token) {
      setError("일반 앱 주소가 아니라, #setup= 부분이 포함된 개인 연결 링크 전체를 복사해 주세요.");
      input.current?.focus();
      return;
    }
    setup.current = token;
    setValue("");
    void connect(token, true);
  }
  async function pasteLink() {
    setError(""); setMessage("");
    try {
      if (!navigator.clipboard?.readText) throw new Error("manual-paste");
      const text = await navigator.clipboard.readText();
      if (!text.trim()) throw new Error("empty-clipboard");
      useLink(text);
    } catch {
      setMessage("아래 입력칸을 길게 눌러 ‘붙여넣기’를 선택해 주세요. 링크가 붙여넣어지면 바로 연결합니다.");
      input.current?.focus();
    }
  }
  async function copyForHome() {
    if (!setup.current) return;
    try {
      await navigator.clipboard.writeText(`${location.origin}/device#setup=${setup.current}`);
      setMessage("복사했어요. 기존 홈 화면 아이콘을 열고 ‘복사한 링크로 연결’을 눌러 주세요.");
    } catch { setMessage("대화에서 받은 개인 연결 링크를 길게 눌러 복사한 뒤, 홈 화면 아이콘 안에서 붙여넣어 주세요."); }
  }
  useEffect(() => {
    if (started.current) return;
    started.current = true;
    installed.current = window.matchMedia("(display-mode: standalone)").matches ||
      (navigator as Navigator & { standalone?: boolean }).standalone === true;
    setStandalone(installed.current);
    const params = new URLSearchParams(location.search);
    next.current = deviceNext(params.get("next"));
    const token = parseDeviceLink(location.href, location.origin);
    setup.current = token;
    if (location.hash) history.replaceState(null, "", location.pathname + location.search);
    if (params.has("disconnected")) { setBusy(false); return; }
    void connect(token, !!token);
  }, []);
  return <AuthFrame title={ready ? "이 브라우저가 연결됐어요" : "나만의 PASS ON"}
    description={ready ? "기존 홈 화면 아이콘은 그 안에서 한 번 더 연결해 주세요." : "한 번만 연결하면, 이 아이콘에서 바로 남길 수 있어요."}>
    <div className="card" aria-busy={busy}>
      {ready ? <>
        <h2>이미 홈 화면에 추가했다면</h2>
        <p>Safari와 홈 화면 앱의 연결은 서로 따로예요. 아래에서 링크를 복사한 뒤, 기존 아이콘을 열어 붙여넣어 주세요.</p>
        <button className="primary" onClick={() => void copyForHome()}>홈 화면 연결 링크 복사</button>
        <p className="hint">처음 설치한다면 Safari 공유 ↑ → 홈 화면에 추가. 설치 후 연결 화면이 나오면 같은 링크를 붙여넣어 주세요.</p>
        <a className="text-link centered" href="/capture">이 브라우저에서 바로 남기기</a>
        <Status message={message} error={error} />
      </> : <>
        <h2>{standalone ? "이 홈 화면 연결하기" : "이 기기 연결하기"}</h2>
        <p className="hint">대화에서 받은 <strong>개인 연결 링크를 복사</strong>한 뒤 아래 버튼을 눌러 주세요. 이메일·비밀번호는 입력하지 않습니다.</p>
        <button className="primary" disabled={busy} onClick={() => void pasteLink()}>
          {busy ? "연결 확인 중…" : "복사한 링크로 연결"}
        </button>
        <form onSubmit={e => { e.preventDefault(); useLink(value); }}>
          <label htmlFor="personal-link">버튼이 안 되면 여기에 직접 붙여넣기</label>
          <input id="personal-link" ref={input} type="text" inputMode="url"
            autoComplete="off" autoCapitalize="none" autoCorrect="off" spellCheck={false}
            data-private="true" maxLength={2048} value={value} disabled={busy}
            placeholder="개인 연결 링크 전체 붙여넣기"
            onChange={e => setValue(e.target.value)}
            onPaste={e => {
              const text = e.clipboardData.getData("text");
              if (parseDeviceLink(text, location.origin)) { e.preventDefault(); useLink(text); }
            }} />
          <button className="text-link" type="submit" disabled={busy || !value.trim()} style={{marginTop:12}}>붙여넣은 링크로 연결</button>
        </form>
        <Status error={error} message={message} />
        {setup.current && error && <button className="text-link" disabled={busy} onClick={() => void connect(setup.current, true)}>연결 다시 시도</button>}
        <p className="hint">새로 설치할 필요 없어요. 연결은 지금 열린 앱 안에 저장됩니다.</p>
      </>}
    </div>
    <p className="hint centered">기존 글·사진·목소리는 원래 저장소 그대로.<br />개인 연결 링크는 다른 사람에게 공유하지 마세요.</p>
    <p className="hint centered" style={{fontSize:11}}>홈 화면 연결 v2</p>
  </AuthFrame>;
}
