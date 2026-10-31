import { test } from "node:test";
import assert from "node:assert/strict";
import { createHash, createHmac } from "node:crypto";
import { DEVICE_MAX_AGE, issueDevice, readDevice, safeDeviceNext, validBootstrap } from "../src/lib/device-security";
const owner = "00000000-0000-4000-8000-000000000001";
const now = Date.UTC(2026, 10, 1);
process.env.PASS_ON_OWNER_ID = owner;
process.env.PASS_ON_DEVICE_SECRET = "a".repeat(64);
const token = issueDevice(now);
test("signed device resumes the pinned owner", () => assert.equal(readDevice(token, now)?.owner, owner));
test("credentials are distinct per device", () => assert.notEqual(issueDevice(now), token));
test("missing device fails closed", () => assert.equal(readDevice(undefined, now), null));
test("empty and malformed devices fail closed", () => { for(const s of ["", "a.b", "x".repeat(2048), token + ".x"]) assert.equal(readDevice(s, now), null); });
test("forged signature is rejected", () => assert.equal(readDevice(token.slice(0,-1)+(token.endsWith("A")?"B":"A"), now), null));
test("expired device is rejected", () => assert.equal(readDevice(token, now + DEVICE_MAX_AGE*1000), null));
test("device issued too far in the future is rejected", () => assert.equal(readDevice(token, now - 120000), null));
test("a validly signed foreign owner is rejected", () => {
 const body=JSON.parse(Buffer.from(token.split(".")[0],"base64url").toString()); body.owner="00000000-0000-4000-8000-000000000002";
 const p=Buffer.from(JSON.stringify(body)).toString("base64url"); const s=createHmac("sha256",Buffer.from("a".repeat(64),"hex")).update(p).digest("base64url");
 assert.equal(readDevice(`${p}.${s}`,now),null);
});
test("unsafe destinations are rejected", () => { for(const s of ["//evil.test", "https://evil.test", "/capture/../admin", "/capture?next=x", null]) assert.equal(safeDeviceNext(s),"/capture"); });
test("allowed destinations survive", () => assert.equal(safeDeviceNext("/archive"),"/archive"));
test("private setup token requires its hash and nonexpired window", () => {
 const t="b".repeat(64); process.env.PASS_ON_SETUP_HASH=createHash("sha256").update(t).digest("hex");
 process.env.PASS_ON_SETUP_EXPIRES=new Date(now+60000).toISOString();
 assert.equal(validBootstrap(t,now),true); assert.equal(validBootstrap("c".repeat(64),now),false);
 assert.equal(validBootstrap(t,now+60000),false); assert.equal(validBootstrap(null,now),false);
 delete process.env.PASS_ON_SETUP_EXPIRES; assert.equal(validBootstrap(t,now),false);
});
test("missing server configuration fails closed", () => {
 const s=process.env.PASS_ON_DEVICE_SECRET; delete process.env.PASS_ON_DEVICE_SECRET;
 assert.equal(readDevice(token,now),null); assert.throws(()=>issueDevice(now)); process.env.PASS_ON_DEVICE_SECRET=s;
});
