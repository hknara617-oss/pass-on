import { createHash, createHmac, randomUUID, timingSafeEqual } from "node:crypto";
export const DEVICE_COOKIE = "__Host-passon-device";
export const DEVICE_MAX_AGE = 365 * 24 * 60 * 60;
type Device = { v: 1; purpose: "pass-on-device"; owner: string; id: string; iat: number; exp: number };
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
export function deviceConfig() {
  const owner = process.env.PASS_ON_OWNER_ID || "";
  const secret = process.env.PASS_ON_DEVICE_SECRET || "";
  if (!uuid.test(owner) || !/^[0-9a-f]{64}$/i.test(secret)) throw new Error("Personal access is not configured");
  return { owner, secret };
}
function mac(payload: string, secret: string) {
  return createHmac("sha256", Buffer.from(secret, "hex")).update(payload).digest("base64url");
}
function equal(a: string, b: string) {
  const x = Buffer.from(a), y = Buffer.from(b);
  return x.length === y.length && timingSafeEqual(x, y);
}
export function issueDevice(now = Date.now()) {
  const { owner, secret } = deviceConfig();
  const iat = Math.floor(now / 1000);
  const claims: Device = { v: 1, purpose: "pass-on-device", owner, id: randomUUID(), iat, exp: iat + DEVICE_MAX_AGE };
  const payload = Buffer.from(JSON.stringify(claims)).toString("base64url");
  return `${payload}.${mac(payload, secret)}`;
}
export function readDevice(token: string | undefined, now = Date.now()): Device | null {
  try {
    if (!token || token.length > 1024 || !/^[A-Za-z0-9_-]+\.[A-Za-z0-9_-]{43}$/.test(token)) return null;
    const { owner, secret } = deviceConfig();
    const [payload, signature] = token.split(".");
    if (!equal(signature, mac(payload, secret))) return null;
    const d = JSON.parse(Buffer.from(payload, "base64url").toString("utf8")) as Device;
    const time = Math.floor(now / 1000);
    if (d.v !== 1 || d.purpose !== "pass-on-device" || d.owner !== owner || !uuid.test(d.id) ||
        !Number.isSafeInteger(d.iat) || !Number.isSafeInteger(d.exp) || d.iat > time + 60 ||
        d.exp <= time || d.exp <= d.iat || d.exp - d.iat > DEVICE_MAX_AGE) return null;
    return d;
  } catch { return null; }
}
export function validBootstrap(value: unknown, now = Date.now()) {
  const expected = process.env.PASS_ON_SETUP_HASH || "";
  const expires = Date.parse(process.env.PASS_ON_SETUP_EXPIRES || "");
  if (typeof value !== "string" || !/^[0-9a-f]{64}$/i.test(value) ||
      !/^[0-9a-f]{64}$/i.test(expected) || !Number.isFinite(expires) || expires <= now) return false;
  return equal(createHash("sha256").update(value).digest("hex"), expected.toLowerCase());
}
export function safeDeviceNext(value: unknown) {
  return typeof value === "string" && /^\/(capture|archive|revisit|data)$/.test(value) ? value : "/capture";
}
