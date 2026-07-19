"use server";

import { createClient } from "@/lib/supabase/server";

export type ActionResult = { ok: true } | { ok: false; error: string };

/**
 * Update the current user's own display name. Relies on the existing
 * profiles_self_update RLS policy (id = auth.uid()) — no new policy needed.
 */
export async function updateDisplayName(fullName: string): Promise<ActionResult> {
  const trimmed = fullName.trim();
  if (!trimmed) {
    return { ok: false, error: "Enter your name." };
  }

  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return { ok: false, error: "Not signed in." };
  }

  const { error } = await supabase
    .from("profiles")
    .update({ full_name: trimmed })
    .eq("id", user.id);
  if (error) return { ok: false, error: error.message };
  return { ok: true };
}
