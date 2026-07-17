import { createClient } from "@/lib/supabase/client";

/**
 * Access-management RPCs. Every one is admin-checked inside the database
 * (SECURITY DEFINER + is_workspace_admin), so the UI gating here is only for
 * convenience — the server is the real enforcement point.
 */

/** Full access on/off. Enabling also clears any per-folder rows server-side. */
export async function setAllFoldersAccess(
  workspaceId: string,
  userId: string,
  enabled: boolean
): Promise<void> {
  const supabase = createClient();
  const { error } = await supabase.rpc("set_all_folders_access", {
    p_workspace_id: workspaceId,
    p_user_id: userId,
    p_enabled: enabled,
  });
  if (error) throw new Error(error.message);
}

/** Grant/revoke a single folder for a user (Selected mode). */
export async function setFolderAccess(
  folderId: string,
  userId: string,
  enabled: boolean
): Promise<void> {
  const supabase = createClient();
  const { error } = await supabase.rpc("set_folder_access", {
    p_folder_id: folderId,
    p_user_id: userId,
    p_enabled: enabled,
  });
  if (error) throw new Error(error.message);
}

/** Revoke everything: full flag off + drop all per-folder grants (None mode). */
export async function clearAllFolderAccess(
  workspaceId: string,
  userId: string
): Promise<void> {
  const supabase = createClient();
  const { error } = await supabase.rpc("clear_all_folder_access", {
    p_workspace_id: workspaceId,
    p_user_id: userId,
  });
  if (error) throw new Error(error.message);
}
