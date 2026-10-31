import { test } from "node:test";
import assert from "node:assert/strict";
import { parseDeviceLink, deviceNext } from "../src/lib/device-link";
const origin = "https://pass-on-jet.vercel.app", token = "d".repeat(64);
const link = `${origin}/device#setup=${token}`;
test("full private link parses without navigating",()=>assert.equal(parseDeviceLink(link,origin),token));
test("copied link trims surrounding whitespace",()=>assert.equal(parseDeviceLink(` \n${link}\n `,origin),token));
test("bare private key can be pasted",()=>assert.equal(parseDeviceLink(token,origin),token));
test("plain app URL is not an enrollment credential",()=>assert.equal(parseDeviceLink(origin,origin),null));
test("foreign, insecure, and credential-bearing links are refused",()=>{
 for(const u of [`https://evil.test/device#setup=${token}`,`http://pass-on-jet.vercel.app/device#setup=${token}`,`https://user@pass-on-jet.vercel.app/device#setup=${token}`,`https://pass-on-jet.vercel.app.evil.test/device#setup=${token}`,`javascript:${token}`]) assert.equal(parseDeviceLink(u,origin),null);
});
test("missing, duplicate and malformed private fragments are refused",()=>{
 for(const u of [`${origin}/device?setup=${token}`,`${link}&setup=${token}`,`${origin}/device#setup=short`,`${origin}/capture#setup=${token}`,"x".repeat(2049),null]) assert.equal(parseDeviceLink(u,origin),null);
});
test("production link accepted in same-origin preview test",()=>assert.equal(parseDeviceLink(link,"https://preview.vercel.app"),token));
test("external next destinations never leave the app",()=>{
 for(const s of ["https://evil.test","//evil.test","/capture?x=1",null]) assert.equal(deviceNext(s),"/capture");
 assert.equal(deviceNext("/archive"),"/archive");
});
