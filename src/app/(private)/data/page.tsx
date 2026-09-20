import { createClient } from "@/lib/supabase/server";
import { readChildren } from "@/lib/records";
import { DataAccount } from "@/components/data-account";
export default async function Page() {
  const c = await createClient();
  const { data } = await c.auth.getUser();
  if (!data.user) return null;
  const children = await readChildren(c, data.user.id);
  return (
    <DataAccount
      userId={data.user.id}
      email={data.user.email || ""}
      childNames={children.map((c) => c.name)}
    />
  );
}
