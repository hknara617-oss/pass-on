import test from "node:test";
import assert from "node:assert/strict";
import {
  visibleEntries,
  revisitEntries,
  safeExternalUrl,
  persistCapture,
  CaptureFailure,
  type CaptureDraft,
  type CaptureMedia,
} from "../src/lib/records";
import type { Entry } from "../src/lib/types";
import type { SupabaseClient } from "@supabase/supabase-js";

test("21 original rows remain distinct from 19 visible + 2 deleted rows", () => {
  const all = Array.from(
    { length: 21 },
    (_, i) =>
      ({
        id: `entry-${i}`,
        is_deleted: i >= 19,
        created_at: "2026-01-01T00:00:00Z",
      }) as Entry,
  );
  const before = JSON.stringify(all);
  assert.equal(visibleEntries(all).length, 19);
  assert.equal(visibleEntries(all, true).length, 2);
  assert.equal(JSON.stringify(all), before);
});
test("revisit is pull only after 14 days and excludes deleted records", () => {
  const now = Date.parse("2026-09-20T12:00:00Z");
  const entries = [
    { id: "old", created_at: "2026-09-06T12:00:00Z", is_deleted: false },
    { id: "recent", created_at: "2026-09-07T12:00:00Z", is_deleted: false },
    { id: "deleted", created_at: "2026-08-01T00:00:00Z", is_deleted: true },
  ] as Entry[];
  assert.deepEqual(
    revisitEntries(entries, now).map((e) => e.id),
    ["old"],
  );
});
test("untrusted links cannot become executable URLs", () => {
  for (const url of [
    "javascript:alert(1)",
    "data:text/html,test",
    "file:///etc/passwd",
    "not a url",
    null,
  ])
    assert.equal(safeExternalUrl(url), null);
  assert.equal(
    safeExternalUrl("https://example.com/article"),
    "https://example.com/article",
  );
});

// Isolated test double: no production credentials, accounts, or rows are used.
function database() {
  const tables: Record<string, Record<string, any>[]> = {
    children: [{ id: "child", user_id: "parent" }],
    entries: [],
    attachments: [],
    link_attachments: [],
  };
  const objects = new Map<string, Blob>();
  let failAttachment = false;
  class Query {
    filters: [string, unknown][] = [];
    row: Record<string, unknown> | null = null;
    singleRow = false;
    constructor(public table: string) {}
    select(_?: string) {
      return this;
    }
    eq(key: string, value: unknown) {
      this.filters.push([key, value]);
      return this;
    }
    order() {
      return this;
    }
    maybeSingle() {
      this.singleRow = true;
      return this;
    }
    single() {
      this.singleRow = true;
      return this;
    }
    insert(row: Record<string, unknown>) {
      this.row = row;
      return this;
    }
    then(resolve: (value: unknown) => unknown) {
      if (this.row) {
        if (this.table === "attachments" && failAttachment) {
          failAttachment = false;
          return Promise.resolve({
            data: null,
            error: new Error("simulated timeout"),
          }).then(resolve);
        }
        if (tables[this.table].some((x) => x.id === this.row?.id))
          return Promise.resolve({
            data: null,
            error: new Error("duplicate"),
          }).then(resolve);
        tables[this.table].push({ ...this.row });
      }
      const rows = tables[this.table]
        .filter((row) =>
          this.filters.every(([key, value]) => row[key] === value),
        )
        .map((row) =>
          this.table === "entries"
            ? {
                ...row,
                attachments: tables.attachments.filter(
                  (a) => a.entry_id === row.id,
                ),
                link_attachments: tables.link_attachments.filter(
                  (a) => a.entry_id === row.id,
                ),
                entry_notes: [],
                entry_revisions: [],
              }
            : row,
        );
      return Promise.resolve({
        data: this.singleRow ? rows[0] || null : rows,
        error: null,
      }).then(resolve);
    }
  }
  const client = {
    from: (table: string) => new Query(table),
    storage: {
      from: () => ({
        upload: async (path: string, file: Blob) => {
          if (objects.has(path))
            return { error: new Error("duplicate object") };
          objects.set(path, file);
          return { error: null };
        },
        download: async (path: string) => ({
          data: objects.get(path),
          error: objects.has(path) ? null : new Error("missing"),
        }),
      }),
    },
  } as unknown as SupabaseClient;
  return {
    client,
    tables,
    objects,
    failNextAttachment: () => {
      failAttachment = true;
    },
  };
}
const draft = (): CaptureDraft => ({
  id: "test-entry",
  childId: "child",
  text: "Test only",
  url: "https://example.com/article",
  quote: "A passage",
  linkId: "test-link",
  createdAt: "2026-09-20T00:00:00Z",
});
const media = (): CaptureMedia[] => [
  {
    id: "test-media",
    type: "photo",
    file: new Blob(["test-image-bytes"], { type: "image/png" }),
    mime: "image/png",
    extension: "png",
    duration: null,
  },
];

test("capture preserves UUID ownership and verifies text, photo, link before success", async () => {
  const db = database();
  const result = await persistCapture(db.client, "parent", draft(), media());
  assert.equal(result.id, "test-entry");
  assert.equal(result.user_id, "parent");
  assert.equal(result.child_id, "child");
  assert.equal(result.attachments.length, 1);
  assert.equal(result.link_attachments.length, 1);
  assert.ok(db.objects.has("parent/test-entry/test-media.png"));
});
test("capture retry after attachment failure does not duplicate entry, media, or link", async () => {
  const db = database();
  db.failNextAttachment();
  await assert.rejects(
    () => persistCapture(db.client, "parent", draft(), media()),
    (e) => e instanceof CaptureFailure && e.entryExists,
  );
  assert.equal(db.tables.entries.length, 1);
  assert.equal(db.tables.attachments.length, 0);
  assert.equal(db.objects.size, 1);
  await persistCapture(db.client, "parent", draft(), media());
  await persistCapture(db.client, "parent", draft(), media());
  assert.equal(db.tables.entries.length, 1);
  assert.equal(db.tables.attachments.length, 1);
  assert.equal(db.tables.link_attachments.length, 1);
  assert.equal(db.objects.size, 1);
});
test("capture refuses a child belonging to another user before insertion", async () => {
  const db = database();
  await assert.rejects(
    () => persistCapture(db.client, "stranger", draft(), []),
    /받는 아이/,
  );
  assert.equal(db.tables.entries.length, 0);
});
test("capture refuses unsafe links and empty records before any writes", async () => {
  const db = database();
  await assert.rejects(
    () =>
      persistCapture(
        db.client,
        "parent",
        { ...draft(), url: "javascript:alert(1)" },
        [],
      ),
    /http/,
  );
  await assert.rejects(
    () =>
      persistCapture(
        db.client,
        "parent",
        { ...draft(), text: " ", quote: "", url: "" },
        [],
      ),
    /남길 내용/,
  );
  assert.equal(db.tables.entries.length, 0);
});
test("retry never overwrites a different existing file", async () => {
  const db = database();
  db.objects.set(
    "parent/test-entry/test-media.png",
    new Blob(["different bytes!"]),
  );
  await assert.rejects(
    () => persistCapture(db.client, "parent", draft(), media()),
    CaptureFailure,
  );
  assert.equal(
    await db.objects.get("parent/test-entry/test-media.png")!.text(),
    "different bytes!",
  );
  assert.equal(db.tables.attachments.length, 0);
});
