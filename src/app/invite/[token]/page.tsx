import { createClient } from "@/lib/supabase/server";
import type { InvitationPreview } from "@/lib/invitations";
import { AcceptInvite } from "@/components/invite/AcceptInvite";

export const dynamic = "force-dynamic";

export default async function InvitePage({
  params,
}: {
  params: { token: string };
}) {
  const supabase = createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  // Tokened preview (works logged-out via the anon grant on the RPC).
  const { data } = await supabase.rpc("get_invitation_preview", {
    p_token: params.token,
  });

  const preview =
    Array.isArray(data) && data.length > 0
      ? (data[0] as InvitationPreview)
      : null;

  return (
    <AcceptInvite
      token={params.token}
      preview={preview}
      currentEmail={user?.email ?? null}
    />
  );
}
