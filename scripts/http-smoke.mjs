import { spawn } from "node:child_process";
import assert from "node:assert/strict";
const port = 3217;
const server = spawn(
  process.execPath,
  [
    "node_modules/next/dist/bin/next",
    "start",
    "--hostname",
    "127.0.0.1",
    "--port",
    String(port),
  ],
  {
    stdio: ["ignore", "pipe", "pipe"],
    env: { ...process.env, NEXT_TELEMETRY_DISABLED: "1" },
  },
);
let logs = "";
try {
  await new Promise((resolve, reject) => {
    const timer = setTimeout(
      () => reject(new Error("Server startup timed out")),
      20000,
    );
    const observe = (chunk) => {
      logs += chunk.toString();
      if (logs.includes("Ready in")) {
        clearTimeout(timer);
        resolve();
      }
    };
    server.stdout.on("data", observe);
    server.stderr.on("data", observe);
    server.once("exit", (code) => {
      clearTimeout(timer);
      reject(new Error(`Server exited: ${code}`));
    });
  });
  const base = `http://127.0.0.1:${port}`;
  for (const [path, expected] of [
    ["/login", "비밀번호를 잊으셨나요?"],
    ["/forgot-password", "가입한 이메일"],
    ["/auth/confirm", "이메일 확인"],
    ["/auth/update-password", "새 비밀번호 설정"],
    ["/auth/error", "인증 링크를 확인"],
  ]) {
    const response = await fetch(base + path);
    assert.equal(response.status, 200);
    assert.ok((await response.text()).includes(expected), path);
    assert.equal(response.headers.get("referrer-policy"), "no-referrer");
    console.log(`PASS ${path} renders expected UI and privacy headers`);
  }
  for (const path of [
    "/capture",
    "/archive",
    "/data",
    "/data/security",
    "/revisit",
  ]) {
    const response = await fetch(base + path, { redirect: "manual" });
    assert.equal(response.status, 307);
    assert.equal(
      new URL(response.headers.get("location"), base).pathname,
      "/login",
    );
    assert.match(response.headers.get("cache-control"), /no-store/);
    console.log(
      `PASS ${path} rejects unauthenticated access without cached data`,
    );
  }
  const invalid = await fetch(base + "/auth/callback?code=not-a-valid-code", {
    redirect: "manual",
  });
  assert.equal(invalid.status, 307);
  assert.equal(
    new URL(invalid.headers.get("location"), base).pathname,
    "/auth/error",
  );
  console.log("PASS invalid recovery code fails closed");
  const origin = await fetch(base + "/api/auth/register", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      origin: "https://attacker.invalid",
    },
    body: "{}",
  });
  assert.equal(origin.status, 403);
  console.log("PASS cross-origin registration rejected before auth");
  console.log(
    "PASS HTTP smoke: 12 checks; no account creation or password change",
  );
} finally {
  server.kill("SIGTERM");
}
