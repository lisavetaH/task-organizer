"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { LogOut, AlertTriangle } from "lucide-react";
import { logOut } from "@/lib/auth-actions";
import { deleteOwnAccount } from "@/lib/account-actions";
import { deleteWorkspace } from "@/lib/members-actions";
import { TypeToConfirmDialog } from "@/components/TypeToConfirmDialog";

export interface OwnedWorkspace {
  id: string;
  name: string;
}

/**
 * Log out + permanent account deletion. If the current user owns any
 * workspace, deletion is blocked here in the UI (requirement 5) — the
 * database (delete_own_account) enforces the same rule independently, so
 * this is convenience, not the real gate.
 */
export function DangerZone({ ownedWorkspaces }: { ownedWorkspaces: OwnedWorkspace[] }) {
  const router = useRouter();
  const [showBlocked, setShowBlocked] = useState(false);
  const [showDeleteAccount, setShowDeleteAccount] = useState(false);
  const [deleteWorkspaceTarget, setDeleteWorkspaceTarget] = useState<OwnedWorkspace | null>(null);
  const [error, setError] = useState<string | null>(null);

  function handleDeleteClick() {
    setError(null);
    if (ownedWorkspaces.length > 0) {
      setShowBlocked(true);
    } else {
      setShowDeleteAccount(true);
    }
  }

  async function handleConfirmDeleteAccount() {
    const res = await deleteOwnAccount();
    // On success this redirects server-side and never returns. It only
    // resolves here on failure (e.g. an owned workspace appeared between
    // page load and confirmation).
    if (res && !res.ok) throw new Error(res.error);
  }

  async function handleConfirmDeleteWorkspace() {
    if (!deleteWorkspaceTarget) return;
    const res = await deleteWorkspace(deleteWorkspaceTarget.id);
    if (!res.ok) throw new Error(res.error);
    setDeleteWorkspaceTarget(null);
    setShowBlocked(false);
    router.refresh();
  }

  return (
    <section className="mt-6">
      <p className="px-1 text-xs font-medium uppercase tracking-wide text-gray-400">
        Danger zone
      </p>

      <div className="mt-2 overflow-hidden rounded-xl border border-gray-200 bg-white">
        <form action={logOut}>
          <button
            type="submit"
            className="flex w-full items-center gap-3 border-b border-gray-100 px-4 py-4 text-left active:bg-gray-50"
          >
            <LogOut className="h-5 w-5 text-gray-500" aria-hidden="true" />
            <span className="text-base font-medium text-gray-900">Log out</span>
          </button>
        </form>

        <button
          type="button"
          onClick={handleDeleteClick}
          className="flex w-full items-center gap-3 px-4 py-4 text-left active:bg-red-50"
        >
          <AlertTriangle className="h-5 w-5 text-red-600" aria-hidden="true" />
          <span className="text-base font-medium text-red-600">Delete my account</span>
        </button>
      </div>

      {error ? (
        <p className="mt-2 px-1 text-sm text-red-600" role="alert">
          {error}
        </p>
      ) : null}

      {showBlocked ? (
        <div
          className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 sm:items-center"
          role="dialog"
          aria-modal="true"
          aria-label="Cannot delete account"
        >
          <div className="w-full max-w-sm rounded-t-2xl bg-white p-4 sm:rounded-2xl">
            <h2 className="text-base font-semibold text-gray-900">
              You still own a workspace
            </h2>
            <p className="mt-2 text-sm text-gray-600">
              You must transfer ownership to another member or delete the
              workspace before you can delete your account.
            </p>

            <ul className="mt-4 divide-y divide-gray-100 rounded-xl border border-gray-100">
              {ownedWorkspaces.map((ws) => (
                <li key={ws.id} className="flex items-center justify-between gap-2 px-3 py-3">
                  <span className="min-w-0 flex-1 truncate text-sm font-medium text-gray-900">
                    {ws.name}
                  </span>
                  <Link
                    href="/users"
                    className="shrink-0 rounded-lg border border-gray-200 px-2.5 py-1.5 text-xs font-semibold text-gray-700 active:bg-gray-50"
                  >
                    Transfer ownership
                  </Link>
                  <button
                    type="button"
                    onClick={() => setDeleteWorkspaceTarget(ws)}
                    className="shrink-0 rounded-lg border border-red-200 px-2.5 py-1.5 text-xs font-semibold text-red-600 active:bg-red-50"
                  >
                    Delete workspace
                  </button>
                </li>
              ))}
            </ul>

            <button
              type="button"
              onClick={() => setShowBlocked(false)}
              className="mt-4 w-full rounded-xl border border-gray-200 py-2.5 text-sm font-semibold text-gray-700 active:bg-gray-50"
            >
              Close
            </button>
          </div>
        </div>
      ) : null}

      {deleteWorkspaceTarget ? (
        <TypeToConfirmDialog
          title={`Delete "${deleteWorkspaceTarget.name}"?`}
          description="This permanently deletes the workspace and everything in it — every folder, task, photo, attachment, and member's access. This cannot be undone."
          confirmWord="DELETE"
          confirmLabel="Delete workspace"
          onCancel={() => setDeleteWorkspaceTarget(null)}
          onConfirm={handleConfirmDeleteWorkspace}
        />
      ) : null}

      {showDeleteAccount ? (
        <TypeToConfirmDialog
          title="Delete your account?"
          description="This permanently deletes your account, your profile, and your access to every workspace. This cannot be undone."
          confirmWord="DELETE"
          confirmLabel="Delete my account"
          onCancel={() => setShowDeleteAccount(false)}
          onConfirm={handleConfirmDeleteAccount}
        />
      ) : null}
    </section>
  );
}
