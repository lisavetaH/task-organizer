"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

export type ActionResult = { ok: true } | { ok: false; error: string };

/**
 * Permanently delete the signed-in user's own account. The database
 * (delete_own_account) is the real enforcement point: it rejects the call
 * if the caller still owns any workspace, deletes invitations tied to
 * them, then deletes their auth.users row -- which cascades through
 * profiles, memberships, and Supabase's own session/refresh-token tables.
 *
 * On success this signs the local session out (matching auth-actions.ts's
 * logOut) and redirects to /login -- there is no account left to return to.
 */
export async function deleteOwnAccount(): Promise<ActionResult> {
  const supabase = createClient();
  const { error } = await supabase.rpc("delete_own_account");
  if (error) return { ok: false, error: error.message };

  await supabase.auth.signOut();
  redirect("/login");
}
