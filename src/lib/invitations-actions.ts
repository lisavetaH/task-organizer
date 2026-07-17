"use server";

import { headers } from "next/headers";
import { createClient } from "@/lib/supabase/server";
import { sendInviteEmail } from "@/lib/email";
import type { Membership } from "@/lib/types";

export type InviteResult =
  | { ok: true; link: string; emailed: boolean }
  | { ok: false; error: string };

export type ActionResult = { ok: true } | { ok: false; error: string };

function siteOrigin(): string {
  const envUrl = process.env.NEXT_PUBLIC_SITE_URL;
  if (envUrl) return envUrl.replace(/\/$/, "");
  const h = headers();
  const host = h.get("x-forwarded-host") ?? h.get("host") ?? "localhost:3000";
  const proto = h.get("x-forwarded-proto") ?? "http";
  return `${proto}://${host}`;
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
    // 23505 = unique_violation on the pending-invite index.
    if (error.code === "23505") {
      return {
        ok: false,
        error: "There is already an active invitation for this email.",
      };
    }
    return { ok: false, error: error.message };
  }

  const link = inviteLink(token as string);
  const name = await workspaceName(supabase, membership.workspace_id);
  const emailed = await sendInviteEmail(email, link, name);
  return { ok: true, link, emailed };
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
  const emailed = await sendInviteEmail(email, link, name);
  return { ok: true, link, emailed };
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
