import { createClient } from "@/lib/supabase/server";
import { readEntries, readChildren, revisitEntries } from "@/lib/records";
import { Archive } from "@/components/archive";
export default async function Page() {
  const c = await createClient();
  const { data } = await c.auth.getUser();
  if (!data.user) return null;
  const [entries, children] = await Promise.all([
    readEntries(c, data.user.id),
    readChildren(c, data.user.id),
  ]);
  return (
    <Archive entries={revisitEntries(entries)} children={children} revisit />
  );
}
