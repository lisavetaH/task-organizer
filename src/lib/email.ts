/**
 * Server-only invitation email sender.
 *
 * Sends via the Resend REST API using plain fetch (no SDK dependency). If
 * RESEND_API_KEY / INVITE_EMAIL_FROM are not configured, this is a no-op and
 * returns false — the caller then shows the admin a copyable invite link so
 * the flow still works without an email provider.
 *
 * This module reads secrets from process.env and must only be imported by
 * server code (it is imported exclusively by the "use server" actions).
 */
export async function sendInviteEmail(
  to: string,
  link: string,
  workspaceName: string
): Promise<boolean> {
  const apiKey = process.env.RESEND_API_KEY;
  const from = process.env.INVITE_EMAIL_FROM;
  if (!apiKey || !from) return false;

  try {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from,
        to,
        subject: `You're invited to ${workspaceName}`,
        html: `
          <div style="font-family:system-ui,sans-serif;max-width:480px;margin:0 auto">
            <h2>You've been invited to ${escapeHtml(workspaceName)}</h2>
            <p>You've been invited to join a workspace on Task Organizer.</p>
            <p>
              <a href="${link}"
                 style="display:inline-block;background:#4f46e5;color:#fff;
                        padding:12px 20px;border-radius:10px;text-decoration:none">
                Accept invitation
              </a>
            </p>
            <p style="color:#6b7280;font-size:13px">
              Or paste this link into your browser:<br />${link}
            </p>
            <p style="color:#9ca3af;font-size:12px">
              This invitation expires in 7 days. If you weren't expecting it,
              you can ignore this email.
            </p>
          </div>
        `,
      }),
    });
    return res.ok;
  } catch {
    return false;
  }
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}
