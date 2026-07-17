import { createClient } from "@/lib/supabase/server";
import type { Membership } from "@/lib/types";
import { CreateWorkspace } from "@/components/folders/CreateWorkspace";
import { CalendarView } from "@/components/schedule/CalendarView";

export const dynamic = "force-dynamic";

export default async function CalendarPage() {
  const supabase = createClient();
  const { data: membership } = await supabase
    .from("workspace_members")
    .select("workspace_id, role")
    .order("joined_at", { ascending: true })
    .limit(1)
    .maybeSingle<Membership>();

  if (!membership) return <CreateWorkspace />;

  return <CalendarView workspaceId={membership.workspace_id} />;
}
