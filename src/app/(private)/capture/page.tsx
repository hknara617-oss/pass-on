import { createClient } from "@/lib/supabase/server";
import { readChildren } from "@/lib/records";
import { Capture } from "@/components/capture";
export default async function Page() {
  const client = await createClient();
  const { data } = await client.auth.getUser();
  if (!data.user) return null;
  return (
    <Capture
      userId={data.user.id}
      children={await readChildren(client, data.user.id)}
    />
  );
}
