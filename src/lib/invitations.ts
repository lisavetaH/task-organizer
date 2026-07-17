import { createClient } from "@/lib/supabase/client";

export interface Invitation {
  id: string;
  email: string;
  role: string;
  status: "pending" | "accepted" | "revoked" | "expired";
  expires_at: string;
  accepted_at: string | null;
  created_at: string;
}

export interface InvitationPreview {
  workspace_name: string;
  email: string;
  status: "pending" | "accepted" | "revoked" | "expired";
  is_expired: boolean;
}

/** Accept an invitation using the raw token. The DB verifies the caller's
 *  verified email matches, row-locks, and joins them to workspace_members. */
export async function acceptInvitation(token: string): Promise<void> {
  const supabase = createClient();
  const { error } = await supabase.rpc("accept_invitation", {
    p_token: token,
  });
  if (error) throw new Error(error.message);
}
