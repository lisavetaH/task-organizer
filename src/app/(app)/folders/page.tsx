import { createClient } from "@/lib/supabase/server";
import {
  FOLDER_METADATA_COLUMNS,
  isWorkspaceAdmin,
  type Folder,
  type Membership,
} from "@/lib/types";
import { CreateWorkspace } from "@/components/folders/CreateWorkspace";
import { FolderManager } from "@/components/folders/FolderManager";

export const dynamic = "force-dynamic";

export default async function FoldersPage() {
  const supabase = createClient();

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

  // Folder metadata list. Since migration 009, RLS (folder_permission-gated)
  // only returns folders this user can actually view — admins/owner see
  // every folder via the admin short-circuit, everyone else sees only their
  // assigned folders. So every folder returned here is already accessible;
  // no separate folder_members lookup is needed to compute that anymore.
  const { data: folders } = await supabase
    .from("folders")
    .select(FOLDER_METADATA_COLUMNS)
    .eq("workspace_id", membership.workspace_id)
    .is("archived_at", null)
    .order("position", { ascending: true })
    .order("created_at", { ascending: true });

  const accessibleIds = (folders ?? []).map((f) => (f as Folder).id);

  return (
    <FolderManager
      workspaceId={membership.workspace_id}
      canManage={isWorkspaceAdmin(membership.role)}
      initialFolders={(folders ?? []) as Folder[]}
      accessibleIds={accessibleIds}
    />
  );
}
