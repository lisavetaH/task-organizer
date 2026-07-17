import { createClient } from "@/lib/supabase/server";
import type { Membership } from "@/lib/types";
import { CreateWorkspace } from "@/components/folders/CreateWorkspace";
import { TodayView } from "@/components/schedule/TodayView";

export const dynamic = "force-dynamic";

export default async function TodayPage() {
  const supabase = createClient();
  const { data: membership } = await supabase
    .from("workspace_members")
    .select("workspace_id, role")
    .order("joined_at", { ascending: true })
    .limit(1)
    .maybeSingle<Membership>();

  if (!membership) return <CreateWorkspace />;

  return <TodayView workspaceId={membership.workspace_id} />;
}
