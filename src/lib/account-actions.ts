"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

export type ActionResult = { ok: true } | { ok: false; error: string };

/**
 * Permanently delete the signed-in user's own account via the
 * `delete-account` Edge Function, which calls the official Supabase Admin
 * API (auth.admin.deleteUser) rather than deleting auth.users directly --
 * see supabase/migrations/012_edge_function_account_deletion.sql and
 * supabase/functions/delete-account/index.ts for the full rationale.
 *
 * The owner-block check and invitation cleanup still happen entirely in the
 * database (prepare_own_account_deletion, run inside the Edge Function using
 * this user's own access token) before the Edge Function ever calls the
 * Admin API -- this app never needs the service-role key.
 *
 * On success this signs the local session out (matching auth-actions.ts's
 * logOut) and redirects to /login -- there is no account left to return to.
 */
export async function deleteOwnAccount(): Promise<ActionResult> {
  const supabase = createClient();
  const {
    data: { session },
  } = await supabase.auth.getSession();
  if (!session) return { ok: false, error: "Not signed in." };

  const res = await fetch(
    `${process.env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1/delete-account`,
    {
      method: "POST",
      headers: { Authorization: `Bearer ${session.access_token}` },
    }
  );
  const body = await res.json().catch(() => ({}));

  if (!res.ok) {
    return { ok: false, error: body.error ?? "Could not delete account." };
  }

  await supabase.auth.signOut();
  redirect("/login");
}
