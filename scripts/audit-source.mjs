import { readdir, readFile } from "node:fs/promises";
import { posix } from "node:path";
import assert from "node:assert/strict";
import ts from "typescript";
async function walk(path){const out=[];for(const e of await readdir(path,{withFileTypes:true})){const p=path+"/"+e.name;if(e.isDirectory())out.push(...await walk(p));else out.push(p);}return out;}
const files=await walk("src"),map=new Map(await Promise.all(files.map(async p=>[p,await readFile(p,"utf8")])));
const all=[...map.values()].join("\n"),bootstrap="src/app/api/device/route.ts";
const privileged=/auth\.admin|createUser\(|deleteUser\(|service_role\s*[:=]|SUPABASE_SERVICE_ROLE_KEY/;
for(const [p,s] of map)if(privileged.test(s))assert.equal(p,bootstrap,`Privileged code outside approved server bootstrap: ${p}`);
const server=map.get(bootstrap)||"";
assert.ok(!server.includes('"use client"')&&!server.includes("'use client'"));
for(const required of ['runtime = "nodejs"','sameOrigin(request)','readDevice(request.cookies.get(DEVICE_COOKIE)?.value)','!linked && !validBootstrap(body.setup)','getUserById(owner)','link.data.user?.id !== owner','verified.data.user?.id !== owner'])assert.ok(server.includes(required),`Bootstrap owner/device check missing: ${required}`);
// Trace every client entry transitively. A filename allowlist alone is insufficient.
function resolve(from,name){let base=name.startsWith("@/")?"src/"+name.slice(2):name.startsWith(".")?posix.normalize(posix.join(posix.dirname(from),name)):null;if(!base)return null;return [base,base+".ts",base+".tsx",base+".js",base+"/index.ts",base+"/index.tsx"].find(p=>map.has(p));}
const visited=new Set();function trace(p){if(visited.has(p))return;visited.add(p);const s=map.get(p)||"";assert.ok(!privileged.test(s),`Privileged module reachable from browser: ${p}`);assert.ok(!/from\s*["'](?:next\/headers|server-only)["']/.test(s),`Server module reachable from browser: ${p}`);for(const spec of ts.preProcessFile(s,true,true).importedFiles){const dep=resolve(p,spec.fileName);if(dep)trace(dep);}}
for(const [p,s] of map)if(/^\s*["']use client["']/.test(s))trace(p);
assert.ok(!/NEXT_PUBLIC_[A-Z_]*(?:SECRET|SERVICE_ROLE)/.test(all),"Public secret variable detected");
assert.ok(!/signOut\(\s*\)|scope:\s*['"](?:global|others)['"]/.test(all),"Global sign-out detected");
assert.ok(!/\.delete\(\)/.test(all),"Unscoped hard-delete operation detected");
assert.ok(!/dangerouslySetInnerHTML/.test(all),"Unsafe content rendering detected");
assert.ok(/signOut\(\{\s*scope:\s*["']local["']\s*\}\)/.test(all));
assert.ok(all.includes("createBrowserClient(url, key)"));
console.log(`PASS: ${files.length} source files; ${visited.size} client-reachable modules checked. Owner/device-gated bootstrap isolated on server; no browser secret, global sign-out, unscoped deletion or unsafe HTML.`);
