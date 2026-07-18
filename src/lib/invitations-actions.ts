"use server";

import { createClient } from "@/lib/supabase/server";
import { sendInviteEmail } from "@/lib/email";
import type { Membership } from "@/lib/types";

export type InviteResult =
  | { ok: true }
  | { ok: false; error: string };

export type ActionResult = { ok: true } | { ok: false; error: string };

// Invitation links must always point at the app's real address, never at
// whatever host happened to serve the request — request headers (host /
// x-forwarded-host) are not used here on purpose. Set APP_URL in production
// (e.g. Vercel); it's intentionally unset in local dev, where the link falls
// back to the local dev server.
const LOCAL_DEV_ORIGIN = "http://localhost:3000";

function siteOrigin(): string {
  const appUrl = process.env.APP_URL;
  return (appUrl && appUrl.trim() ? appUrl : LOCAL_DEV_ORIGIN).replace(/\/$/, "");
}

function inviteLink(token: string): string {
  return `${siteOrigin()}/invite/${token}`;
}

async function resolveWorkspace() {
  const supabase = createClient();
  const { data } = await supabase
    .from("workspace_members")
    .select("workspace_id, role")
    .order("joined_at", { ascending: true })
    .limit(1)
    .maybeSingle<Membership>();
  return { supabase, membership: data };
}

async function workspaceName(
  supabase: ReturnType<typeof createClient>,
  workspaceId: string
): Promise<string> {
  const { data } = await supabase
    .from("workspaces")
    .select("name")
    .eq("id", workspaceId)
    .maybeSingle<{ name: string }>();
  return data?.name ?? "your workspace";
}

/**
 * Create (or refresh via the DB's stale-expiry logic) a worker invitation for
 * an email, then email a secure link. Admin status is enforced inside
 * create_invitation (is_workspace_admin) — the check here is convenience only.
 * Role is always 'worker'; invited users are never admins.
 */
export async function inviteUser(emailRaw: string): Promise<InviteResult> {
  const email = emailRaw.trim().toLowerCase();
  if (!email || !email.includes("@")) {
    return { ok: false, error: "Enter a valid email address." };
  }

  const { supabase, membership } = await resolveWorkspace();
  if (!membership || membership.role !== "admin") {
    return { ok: false, error: "Only administrators can invite users." };
  }

  const { data: token, error } = await supabase.rpc("create_invitation", {
    p_workspace_id: membership.workspace_id,
    p_email: email,
    p_role: "worker",
  });

  if (error) {
    // 23505 = unique_violation on the pending-invite index. A *cancelled* or
    // expired invitation for this email does not trigger this — the index is
    // partial (WHERE status = 'pending') — so this only fires when a pending
    // invitation genuinely already exists.
    if (error.code === "23505") {
      return {
        ok: false,
        error:
          "There is already a pending invitation for this email. Use Resend on that invitation below instead of creating a new one — or delete it first if you want to start over.",
      };
    }
    return { ok: false, error: error.message };
  }

  const link = inviteLink(token as string);
  const name = await workspaceName(supabase, membership.workspace_id);
  const result = await sendInviteEmail(email, link, name);
  if (!result.ok) return { ok: false, error: result.error };
  return { ok: true };
}

/** Regenerate an invitation's token + expiry and re-send. Admin-only in DB. */
export async function resendInvitation(
  invitationId: string,
  email: string
): Promise<InviteResult> {
  const { supabase, membership } = await resolveWorkspace();
  if (!membership || membership.role !== "admin") {
    return { ok: false, error: "Only administrators can resend invitations." };
  }

  const { data: token, error } = await supabase.rpc("resend_invitation", {
    p_invitation_id: invitationId,
  });
  if (error) return { ok: false, error: error.message };

  const link = inviteLink(token as string);
  const name = await workspaceName(supabase, membership.workspace_id);
  const result = await sendInviteEmail(email, link, name);
  if (!result.ok) return { ok: false, error: result.error };
  return { ok: true };
}

/** Cancel a pending invitation (status -> revoked). Admin-only in DB. */
export async function cancelInvitation(
  invitationId: string
): Promise<ActionResult> {
  const supabase = createClient();
  const { error } = await supabase.rpc("revoke_invitation", {
    p_invitation_id: invitationId,
  });
  if (error) return { ok: false, error: error.message };
  return { ok: true };
}

/** Permanently remove an invitation row. Admin-only in DB. */
export async function deleteInvitation(
  invitationId: string
): Promise<ActionResult> {
  const supabase = createClient();
  const { error } = await supabase.rpc("delete_invitation", {
    p_invitation_id: invitationId,
  });
  if (error) return { ok: false, error: error.message };
  return { ok: true };
}
