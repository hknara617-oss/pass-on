// Parse locally. Never navigate to a pasted URL or persist its private fragment.
const TOKEN = /^[0-9a-f]{64}$/i;
export function parseDeviceLink(value: unknown, currentOrigin: string): string | null {
  if (typeof value !== "string" || value.length > 2048) return null;
  const text = value.trim();
  if (TOKEN.test(text)) return text;
  try {
    const url = new URL(text);
    if (url.protocol !== "https:" || url.username || url.password ||
        !["https://pass-on-jet.vercel.app", currentOrigin].includes(url.origin) ||
        url.pathname !== "/device") return null;
    const params = new URLSearchParams(url.hash.slice(1));
    const token = params.get("setup");
    return params.getAll("setup").length === 1 && token && TOKEN.test(token) ? token : null;
  } catch { return null; }
}
export function deviceNext(value: unknown): string {
  return typeof value === "string" && /^\/(capture|archive|revisit|data)$/.test(value) ? value : "/capture";
}
