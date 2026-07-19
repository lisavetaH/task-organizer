"use server";

import { createClient } from "@/lib/supabase/server";

export type ActionResult = { ok: true } | { ok: false; error: string };

/**
 * Promote/demote an existing member between 'admin' and 'member'. Owner-only
 * in the database (change_member_role) — this file adds no extra checks, the
 * RPC is the real enforcement point.
 */
export async function changeMemberRole(
  workspaceId: string,
  userId: string,
  newRole: "admin" | "member"
): Promise<ActionResult> {
  const supabase = createClient();
  const { error } = await supabase.rpc("change_member_role", {
    p_workspace_id: workspaceId,
    p_user_id: userId,
    p_new_role: newRole,
  });
  if (error) return { ok: false, error: error.message };
  return { ok: true };
}

/**
 * Remove a member from the workspace. The database (remove_workspace_member)
 * enforces: the owner can never be removed; only the owner may remove an
 * administrator; the owner or an administrator may remove a plain member.
 */
export async function removeMember(
  workspaceId: string,
  userId: string
): Promise<ActionResult> {
  const supabase = createClient();
  const { error } = await supabase.rpc("remove_workspace_member", {
    p_workspace_id: workspaceId,
    p_user_id: userId,
  });
  if (error) return { ok: false, error: error.message };
  return { ok: true };
}

/**
 * Hand ownership of the workspace to another existing member. Owner-only in
 * the database (transfer_ownership) — atomically demotes the caller to
 * 'admin' and promotes the target to 'owner'.
 */
export async function transferOwnership(
  workspaceId: string,
  newOwnerUserId: string
): Promise<ActionResult> {
  const supabase = createClient();
  const { error } = await supabase.rpc("transfer_ownership", {
    p_workspace_id: workspaceId,
    p_new_owner_user_id: newOwnerUserId,
  });
  if (error) return { ok: false, error: error.message };
  return { ok: true };
}

/**
 * Permanently delete an entire workspace — one of the two ways an owner can
 * unblock their own account deletion (the other is transferOwnership).
 * Owner-only in the database (delete_workspace). The RPC returns every
 * Storage object the workspace's items held so they can be removed here,
 * same pattern as emptyFolderTrash/emptyExpiredTrash in items.ts.
 */
export async function deleteWorkspace(workspaceId: string): Promise<ActionResult> {
  const supabase = createClient();
  const { data, error } = await supabase.rpc("delete_workspace", {
    p_workspace_id: workspaceId,
  });
  if (error) return { ok: false, error: error.message };

  const rows = (data ?? []) as { bucket: string; path: string }[];
  const byBucket = new Map<string, string[]>();
  for (const r of rows) (byBucket.get(r.bucket) ?? byBucket.set(r.bucket, []).get(r.bucket)!).push(r.path);
  for (const [bucket, paths] of byBucket) await supabase.storage.from(bucket).remove(paths);

  return { ok: true };
}
