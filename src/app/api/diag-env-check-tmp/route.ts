import { createHash } from "crypto";
import { NextResponse } from "next/server";

// TEMPORARY diagnostic route — added to compare a hash of the runtime's
// RESEND_API_KEY against a known-good value without ever exposing the raw
// key. Returns no secret material (a SHA-256 digest cannot be reversed to
// recover the key). Remove after use.
export const dynamic = "force-dynamic";

function sha256(value: string): string {
  return createHash("sha256").update(value, "utf8").digest("hex");
}

export async function GET() {
  const key = process.env.RESEND_API_KEY;
  const from = process.env.INVITE_EMAIL_FROM;
  const appUrl = process.env.APP_URL;

  return NextResponse.json({
    resendKeyPresent: Boolean(key),
    resendKeyLength: key ? key.length : 0,
    resendKeySha256: key ? sha256(key) : null,
    inviteEmailFrom: from ?? null,
    appUrl: appUrl ?? null,
  });
}
