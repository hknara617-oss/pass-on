import { readdir, readFile } from "node:fs/promises";
import assert from "node:assert/strict";
async function walk(path) {
  const out = [];
  for (const e of await readdir(path, { withFileTypes: true })) {
    const p = path + "/" + e.name;
    if (e.isDirectory()) out.push(...(await walk(p)));
    else out.push(p);
  }
  return out;
}
const files = await walk("src");
const source = (await Promise.all(files.map((p) => readFile(p, "utf8")))).join(
  "\n",
);
assert.ok(
  !/auth\.admin|createUser\(|deleteUser\(|service_role\s*[:=]|SUPABASE_SERVICE_ROLE_KEY/.test(
    source,
  ),
  "Privileged auth or browser secret detected",
);
assert.ok(
  !/signOut\(\s*\)|scope:\s*['"](?:global|others)['"]/.test(source),
  "Global or implicit global sign-out detected",
);
assert.ok(!/\.delete\(\)/.test(source), "Hard-delete operation detected");
assert.ok(
  !/dangerouslySetInnerHTML/.test(source),
  "Unsafe content rendering detected",
);
assert.ok(/signOut\(\{\s*scope:\s*["']local["']\s*\}\)/.test(source));
assert.ok(source.includes("resetPasswordForEmail"));
assert.ok(/client\.auth\.updateUser\(\{\s*password/.test(source));
assert.ok(source.includes("createBrowserClient(url, key)"));
console.log(
  `PASS: ${files.length} source files checked; no admin auth, hard deletes, global sign-out, or unsafe HTML.`,
);
