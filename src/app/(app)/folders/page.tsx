import { createClient } from "@/lib/supabase/server";
import { FOLDER_METADATA_COLUMNS, type Folder, type Membership } from "@/lib/types";
import { CreateWorkspace } from "@/components/folders/CreateWorkspace";
import { FolderManager } from "@/components/folders/FolderManager";

export const dynamic = "force-dynamic";

export default async function FoldersPage() {
  const supabase = createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  // Resolve the user's workspace + role (RLS: own memberships only).
  const { data: membership } = await supabase
    .from("workspace_members")
    .select("workspace_id, role")
    .order("joined_at", { ascending: true })
    .limit(1)
    .maybeSingle<Membership>();

  if (!membership) {
    return <CreateWorkspace />;
  }

  // Folder metadata list. After migration 003, RLS returns EVERY folder in
  // the workspace (metadata only) to any member — including locked ones.
  const { data: folders } = await supabase
    .from("folders")
    .select(FOLDER_METADATA_COLUMNS)
    .eq("workspace_id", membership.workspace_id)
    .is("archived_at", null)
    .order("position", { ascending: true })
    .order("created_at", { ascending: true });

  // Which of those folders can this user actually open?
  // Admins: all. Workers: only folders where they have can_view = true.
  let accessibleIds: string[] = [];
  if (membership.role === "admin") {
    accessibleIds = (folders ?? []).map((f) => (f as Folder).id);
  } else if (user) {
    const { data: access } = await supabase
      .from("folder_members")
      .select("folder_id, can_view")
      .eq("user_id", user.id);
    accessibleIds = (access ?? [])
      .filter((a) => a.can_view)
      .map((a) => a.folder_id as string);
  }

  return (
    <FolderManager
      workspaceId={membership.workspace_id}
      canManage={membership.role === "admin"}
      initialFolders={(folders ?? []) as Folder[]}
      accessibleIds={accessibleIds}
    />
  );
}
