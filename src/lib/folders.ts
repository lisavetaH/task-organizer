import { createClient } from "@/lib/supabase/client";
import { FOLDER_METADATA_COLUMNS, type Folder } from "@/lib/types";

/**
 * All folder writes here rely on the locked RLS policies:
 *  - folders_admin_insert / folders_admin_update gate who can mutate.
 *  - protect_folder_insert forces created_by/created_at/archived_at.
 * The browser client carries the user's session, so RLS sees auth.uid().
 */

export async function listFolders(workspaceId: string): Promise<Folder[]> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("folders")
    .select(FOLDER_METADATA_COLUMNS)
    .eq("workspace_id", workspaceId)
    .is("archived_at", null)
    .order("position", { ascending: true })
    .order("created_at", { ascending: true });

  if (error) throw new Error(error.message);
  return (data ?? []) as Folder[];
}

export async function createFolder(
  workspaceId: string,
  name: string,
  position: number
): Promise<Folder> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("folders")
    .insert({ workspace_id: workspaceId, name, position })
    .select(FOLDER_METADATA_COLUMNS)
    .single();

  if (error) throw new Error(error.message);
  return data as Folder;
}

export async function renameFolder(id: string, name: string): Promise<void> {
  const supabase = createClient();
  const { error } = await supabase
    .from("folders")
    .update({ name })
    .eq("id", id);
  if (error) throw new Error(error.message);
}

export async function updateFolderMeta(
  id: string,
  meta: { color?: string | null; icon?: string | null }
): Promise<void> {
  const supabase = createClient();
  const { error } = await supabase.from("folders").update(meta).eq("id", id);
  if (error) throw new Error(error.message);
}

/** Soft-delete: archive per the locked "archive folders, don't hard-delete" rule. */
export async function archiveFolder(id: string): Promise<void> {
  const supabase = createClient();
  const { error } = await supabase
    .from("folders")
    .update({ archived_at: new Date().toISOString() })
    .eq("id", id);
  if (error) throw new Error(error.message);
}

/** Persist a new ordering atomically via the reorder_folders RPC. */
export async function reorderFolders(
  workspaceId: string,
  orderedIds: string[]
): Promise<void> {
  const supabase = createClient();
  const { error } = await supabase.rpc("reorder_folders", {
    p_workspace_id: workspaceId,
    p_ordered_ids: orderedIds,
  });
  if (error) throw new Error(error.message);
}

export async function createWorkspace(name: string): Promise<string> {
  const supabase = createClient();
  const { data, error } = await supabase.rpc("create_workspace", {
    p_name: name,
  });
  if (error) throw new Error(error.message);
  // create_workspace returns the workspace row
  return (data as { id: string }).id;
}

/** Folders (metadata) the current user is allowed to CREATE entries in.
 *  Used by the Calendar "+" to choose a destination folder. */
export async function foldersUserCanCreateIn(
  workspaceId: string
): Promise<{ id: string; name: string }[]> {
  const supabase = createClient();
  const { data: folders } = await supabase
    .from("folders")
    .select("id,name")
    .eq("workspace_id", workspaceId)
    .is("archived_at", null)
    .order("position", { ascending: true })
    .order("created_at", { ascending: true });
  const list = (folders ?? []) as { id: string; name: string }[];
  if (list.length === 0) return [];

  // Check create permission per folder via the folder_permission RPC.
  const checks = await Promise.all(
    list.map((f) =>
      supabase
        .rpc("folder_permission", { f_id: f.id, perm: "create" })
        .then(({ data }) => (data ? f : null))
    )
  );
  return checks.filter((f): f is { id: string; name: string } => f !== null);
}
