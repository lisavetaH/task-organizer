"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  UserPlus,
  Send,
  RotateCw,
  X,
  Copy,
  Check,
} from "lucide-react";
import type { Invitation } from "@/lib/invitations";
import {
  inviteUser,
  resendInvitation,
  cancelInvitation,
} from "@/lib/invitations-actions";

type EffectiveStatus = "pending" | "accepted" | "expired" | "cancelled";

function effectiveStatus(inv: Invitation): EffectiveStatus {
  if (inv.status === "accepted") return "accepted";
  if (inv.status === "revoked") return "cancelled";
  if (inv.status === "expired") return "expired";
  // pending: check expiry lazily
  if (new Date(inv.expires_at).getTime() <= Date.now()) return "expired";
  return "pending";
}

const STATUS_STYLE: Record<EffectiveStatus, string> = {
  pending: "bg-amber-100 text-amber-700",
  accepted: "bg-emerald-100 text-emerald-700",
  expired: "bg-gray-100 text-gray-500",
  cancelled: "bg-gray-100 text-gray-500",
};

export function InvitationsPanel({
  invitations,
}: {
  invitations: Invitation[];
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [email, setEmail] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [link, setLink] = useState<string | null>(null);
  const [emailed, setEmailed] = useState(false);
  const [copied, setCopied] = useState(false);
  const [pending, startTransition] = useTransition();

  function submitInvite() {
    const value = email.trim();
    if (!value) {
      setError("Enter an email address.");
      return;
    }
    setError(null);
    setLink(null);
    startTransition(async () => {
      const res = await inviteUser(value);
      if (!res.ok) {
        setError(res.error);
        return;
      }
      setLink(res.link);
      setEmailed(res.emailed);
      setEmail("");
      router.refresh();
    });
  }

  function onResend(inv: Invitation) {
    setError(null);
    setLink(null);
    startTransition(async () => {
      const res = await resendInvitation(inv.id, inv.email);
      if (!res.ok) {
        setError(res.error);
        return;
      }
      setLink(res.link);
      setEmailed(res.emailed);
      router.refresh();
    });
  }

  function onCancel(inv: Invitation) {
    setError(null);
    startTransition(async () => {
      const res = await cancelInvitation(inv.id);
      if (!res.ok) {
        setError(res.error);
        return;
      }
      router.refresh();
    });
  }

  async function copyLink() {
    if (!link) return;
    try {
      await navigator.clipboard.writeText(link);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1500);
    } catch {
      /* clipboard may be unavailable; the link is visible to copy manually */
    }
  }

  const visible = invitations.filter(
    (i) => effectiveStatus(i) !== "accepted"
  );

  return (
    <section className="border-b border-gray-100 px-4 py-4">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-gray-500">
          Invitations
        </h2>
        <button
          type="button"
          onClick={() => {
            setOpen((v) => !v);
            setError(null);
            setLink(null);
          }}
          className="flex items-center gap-1.5 rounded-full bg-brand px-3 py-2 text-sm font-semibold text-white active:bg-brand-dark"
        >
          <UserPlus className="h-4 w-4" />
          Invite
        </button>
      </div>

      {open ? (
        <div className="mt-3 rounded-xl border border-gray-200 p-3">
          <label htmlFor="invite-email" className="sr-only">
            Email address
          </label>
          <div className="flex items-center gap-2">
            <input
              id="invite-email"
              type="email"
              inputMode="email"
              autoComplete="off"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") submitInvite();
              }}
              placeholder="name@example.com"
              className="min-w-0 flex-1 rounded-lg border border-gray-300 px-3 py-2.5 text-base outline-none focus:border-brand focus:ring-1 focus:ring-brand"
            />
            <button
              type="button"
              onClick={submitInvite}
              disabled={pending}
              aria-label="Send invitation"
              className="grid h-11 w-11 shrink-0 place-items-center rounded-lg bg-brand text-white active:bg-brand-dark disabled:opacity-60"
            >
              <Send className="h-5 w-5" />
            </button>
          </div>

          {error ? (
            <p className="mt-2 text-sm text-red-600" role="alert">
              {error}
            </p>
          ) : null}

          {link ? (
            <div className="mt-3 rounded-lg bg-gray-50 p-3">
              <p className="text-sm text-gray-700">
                {emailed
                  ? "Invitation email sent."
                  : "Invite created. Share this link with the person:"}
              </p>
              <div className="mt-2 flex items-center gap-2">
                <code className="min-w-0 flex-1 truncate rounded bg-white px-2 py-1.5 text-xs text-gray-600">
                  {link}
                </code>
                <button
                  type="button"
                  onClick={copyLink}
                  aria-label="Copy link"
                  className="grid h-9 w-9 shrink-0 place-items-center rounded-lg border border-gray-200 text-gray-500 active:bg-gray-100"
                >
                  {copied ? (
                    <Check className="h-4 w-4 text-emerald-600" />
                  ) : (
                    <Copy className="h-4 w-4" />
                  )}
                </button>
              </div>
            </div>
          ) : null}
        </div>
      ) : null}

      {visible.length > 0 ? (
        <ul className="mt-3 space-y-2">
          {visible.map((inv) => {
            const status = effectiveStatus(inv);
            const canResend = status === "pending" || status === "expired";
            const canCancel = status === "pending";
            return (
              <li
                key={inv.id}
                className="flex items-center gap-3 rounded-xl border border-gray-100 px-3 py-2.5"
              >
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium text-gray-900">
                    {inv.email}
                  </p>
                  <span
                    className={`mt-1 inline-block rounded-full px-2 py-0.5 text-xs font-medium capitalize ${STATUS_STYLE[status]}`}
                  >
                    {status}
                  </span>
                </div>
                {canResend ? (
                  <button
                    type="button"
                    onClick={() => onResend(inv)}
                    disabled={pending}
                    aria-label="Resend invitation"
                    className="grid h-9 w-9 place-items-center rounded-lg text-gray-500 active:bg-gray-100 disabled:opacity-60"
                  >
                    <RotateCw className="h-4 w-4" />
                  </button>
                ) : null}
                {canCancel ? (
                  <button
                    type="button"
                    onClick={() => onCancel(inv)}
                    disabled={pending}
                    aria-label="Cancel invitation"
                    className="grid h-9 w-9 place-items-center rounded-lg text-red-500 active:bg-red-50 disabled:opacity-60"
                  >
                    <X className="h-4 w-4" />
                  </button>
                ) : null}
              </li>
            );
          })}
        </ul>
      ) : null}
    </section>
  );
}
