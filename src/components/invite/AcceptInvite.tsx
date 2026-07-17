"use client";

import { useState, useTransition } from "react";
import type { ReactNode } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Lock, Check, MailWarning } from "lucide-react";
import type { InvitationPreview } from "@/lib/invitations";
import { acceptInvitation } from "@/lib/invitations";
import { logOut } from "@/lib/auth-actions";

export function AcceptInvite({
  token,
  preview,
  currentEmail,
}: {
  token: string;
  preview: InvitationPreview | null;
  currentEmail: string | null;
}) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  // Unknown / invalid token.
  if (!preview) {
    return (
      <Shell icon={<MailWarning className="h-7 w-7" />} title="Invitation not found">
        This invitation link is invalid. Ask an administrator to send a new one.
      </Shell>
    );
  }

  if (preview.status === "accepted") {
    return (
      <Shell icon={<Check className="h-7 w-7" />} title="Already accepted">
        This invitation has already been used.{" "}
        <Link href="/folders" className="font-medium text-brand">
          Go to the app
        </Link>
        .
      </Shell>
    );
  }

  if (preview.status === "revoked") {
    return (
      <Shell icon={<Lock className="h-7 w-7" />} title="Invitation cancelled">
        This invitation was cancelled by an administrator.
      </Shell>
    );
  }

  if (preview.status === "expired" || preview.is_expired) {
    return (
      <Shell icon={<Lock className="h-7 w-7" />} title="Invitation expired">
        This invitation has expired. Ask an administrator to resend it.
      </Shell>
    );
  }

  // Pending & valid.
  const inviteHref = `/invite/${token}`;

  // Logged out → sign up or log in with the invited email.
  if (!currentEmail) {
    const q = `?redirect=${encodeURIComponent(inviteHref)}&email=${encodeURIComponent(
      preview.email
    )}`;
    return (
      <Shell title={`Join ${preview.workspace_name}`}>
        <p>
          You&apos;ve been invited as <b>{preview.email}</b>. Sign in with that
          email to join.
        </p>
        <div className="mt-6 space-y-3">
          <Link
            href={`/signup${q}`}
            className="block w-full rounded-xl bg-brand px-4 py-3 text-center text-base font-semibold text-white active:bg-brand-dark"
          >
            Create an account
          </Link>
          <Link
            href={`/login${q}`}
            className="block w-full rounded-xl border border-gray-200 px-4 py-3 text-center text-base font-semibold text-gray-700 active:bg-gray-50"
          >
            I already have an account
          </Link>
        </div>
      </Shell>
    );
  }

  // Logged in with a different email than the invite.
  if (currentEmail.toLowerCase() !== preview.email.toLowerCase()) {
    return (
      <Shell icon={<MailWarning className="h-7 w-7" />} title="Wrong account">
        <p>
          This invitation is for <b>{preview.email}</b>, but you&apos;re signed
          in as <b>{currentEmail}</b>.
        </p>
        <form action={logOut} className="mt-6">
          <button
            type="submit"
            className="w-full rounded-xl border border-gray-200 px-4 py-3 text-base font-semibold text-gray-700 active:bg-gray-50"
          >
            Log out and switch account
          </button>
        </form>
      </Shell>
    );
  }

  // Logged in with the matching email → accept.
  function accept() {
    setError(null);
    startTransition(async () => {
      try {
        await acceptInvitation(token);
        router.replace("/folders");
        router.refresh();
      } catch (e) {
        setError(e instanceof Error ? e.message : "Could not accept invitation.");
      }
    });
  }

  return (
    <Shell title={`Join ${preview.workspace_name}`}>
      <p>
        You&apos;re signed in as <b>{preview.email}</b>. Accept to join the
        workspace as a worker.
      </p>
      {error ? (
        <p className="mt-3 text-sm text-red-600" role="alert">
          {error}
        </p>
      ) : null}
      <button
        type="button"
        onClick={accept}
        disabled={pending}
        className="mt-6 w-full rounded-xl bg-brand px-4 py-3 text-base font-semibold text-white active:bg-brand-dark disabled:opacity-60"
      >
        {pending ? "Joining…" : `Join ${preview.workspace_name}`}
      </button>
    </Shell>
  );
}

function Shell({
  title,
  icon,
  children,
}: {
  title: string;
  icon?: ReactNode;
  children?: ReactNode;
}) {
  return (
    <main className="flex min-h-dvh flex-col justify-center px-6">
      <div className="mx-auto w-full max-w-sm">
        {icon ? (
          <span className="mb-4 grid h-14 w-14 place-items-center rounded-full bg-gray-100 text-gray-400">
            {icon}
          </span>
        ) : null}
        <h1 className="text-2xl font-bold text-gray-900">{title}</h1>
        <div className="mt-2 text-sm text-gray-600">{children}</div>
      </div>
    </main>
  );
}
