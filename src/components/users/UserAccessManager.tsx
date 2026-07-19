"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ChevronLeft, ShieldCheck, Crown, Trash2 } from "lucide-react";
import type { Folder, Role } from "@/lib/types";
import { isWorkspaceAdmin, isWorkspaceOwner } from "@/lib/types";
import type { Invitation } from "@/lib/invitations";
import { InvitationsPanel } from "./InvitationsPanel";
import { setAllFoldersAccess, setFolderAccess } from "@/lib/access";
import { changeMemberRole, removeMember, transferOwnership } from "@/lib/members-actions";
import { FolderPickerModal } from "./FolderPickerModal";

export interface WorkspaceUser {
  user_id: string;
  full_name: string;
  role: Role;
  all_folders_access: boolean;
  is_self: boolean;
}

type FolderAccessMode = "full" | "selected";

function deriveMode(allAccess: boolean): FolderAccessMode {
  return allAccess ? "full" : "selected";
}

export function UserAccessManager({
  workspaceId,
  users,
  folders,
  initialSelectedByUser,
  invitations,
  viewerRole,
}: {
  workspaceId: string;
  users: WorkspaceUser[];
  folders: Folder[];
  initialSelectedByUser: Record<string, string[]>;
  invitations: Invitation[];
  viewerRole: Role;
}) {
  return (
    <main>
      <header className="sticky top-0 z-10 flex items-center gap-2 border-b border-gray-200 bg-white/90 px-2 py-3 backdrop-blur">
        <Link
          href="/more"
          aria-label="Back"
          className="grid h-10 w-10 place-items-center rounded-full text-gray-500 active:bg-gray-100"
        >
          <ChevronLeft className="h-6 w-6" />
        </Link>
        <h1 className="text-lg font-semibold text-gray-900">Users &amp; access</h1>
      </header>

      <InvitationsPanel invitations={invitations} />

      <ul className="divide-y divide-gray-100">
        {users.map((u) => (
          <UserRow
            key={u.user_id}
            user={u}
            workspaceId={workspaceId}
            folders={folders}
            initialSelected={initialSelectedByUser[u.user_id] ?? []}
            viewerRole={viewerRole}
          />
        ))}
      </ul>

      {users.length <= 1 ? (
        <p className="px-6 py-8 text-center text-sm text-gray-400">
          You&apos;re the only member so far. Invite members to assign folder
          access.
        </p>
      ) : null}
    </main>
  );
}

function RoleBadge({ role }: { role: Role }) {
  if (role === "owner") {
    return (
      <span className="mt-0.5 flex items-center gap-1 text-sm text-amber-600">
        <Crown className="h-4 w-4" />
        Owner
      </span>
    );
  }
  if (role === "admin") {
    return (
      <span className="mt-0.5 flex items-center gap-1 text-sm text-brand">
        <ShieldCheck className="h-4 w-4" />
        Administrator
      </span>
    );
  }
  return <span className="mt-0.5 block text-sm text-gray-500">Member</span>;
}

function UserRow({
  user,
  workspaceId,
  folders,
  initialSelected,
  viewerRole,
}: {
  user: WorkspaceUser;
  workspaceId: string;
  folders: Folder[];
  initialSelected: string[];
  viewerRole: Role;
}) {
  const router = useRouter();
  const [allAccess, setAllAccess] = useState(user.all_folders_access);
  const [selected, setSelected] = useState<Set<string>>(
    new Set(initialSelected)
  );
  const [pickerOpen, setPickerOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const mode = deriveMode(allAccess);
  const viewerIsOwner = isWorkspaceOwner(viewerRole);
  const viewerIsAdmin = isWorkspaceAdmin(viewerRole);
  const targetIsAdminTier = isWorkspaceAdmin(user.role);

  // Owner can remove admins or members (not themself). Admin can only
  // remove plain members. The database re-checks this regardless of what
  // renders here (requirement 9) — this is convenience only.
  const canRemove =
    !user.is_self &&
    user.role !== "owner" &&
    (viewerIsOwner || (viewerIsAdmin && user.role === "member"));

  // Only the owner may promote/demote between Administrator and Member, or
  // hand off ownership. Never shown for the owner's own row.
  const canManageRole = viewerIsOwner && user.role !== "owner" && !user.is_self;

  async function handleRoleChange(newRole: "admin" | "member") {
    if (busy || user.role === newRole) return;
    setBusy(true);
    setError(null);
    try {
      const res = await changeMemberRole(workspaceId, user.user_id, newRole);
      if (!res.ok) throw new Error(res.error);
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not change role.");
    } finally {
      setBusy(false);
    }
  }

  async function handleTransferOwnership() {
    if (busy) return;
    if (
      !confirm(
        `Make ${user.full_name} the workspace owner? You will become an administrator and can no longer undo this yourself.`
      )
    ) {
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const res = await transferOwnership(workspaceId, user.user_id);
      if (!res.ok) throw new Error(res.error);
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not transfer ownership.");
    } finally {
      setBusy(false);
    }
  }

  async function handleRemove() {
    if (busy) return;
    if (!confirm(`Remove ${user.full_name} from this workspace?`)) return;
    setBusy(true);
    setError(null);
    try {
      const res = await removeMember(workspaceId, user.user_id);
      if (!res.ok) throw new Error(res.error);
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not remove member.");
    } finally {
      setBusy(false);
    }
  }

  async function changeMode(next: FolderAccessMode) {
    if (busy || next === mode) return;
    if (next === "selected") {
      setPickerOpen(true);
      return;
    }
    setBusy(true);
    setError(null);
    const prevAll = allAccess;
    try {
      await setAllFoldersAccess(workspaceId, user.user_id, true);
      setAllAccess(true);
      setSelected(new Set()); // server clears per-folder rows
    } catch (e) {
      setAllAccess(prevAll);
      setError(e instanceof Error ? e.message : "Could not update access.");
    } finally {
      setBusy(false);
    }
  }

  async function savePickedFolders(selectedIds: string[]) {
    const nextSelected = new Set(selectedIds);
    const toEnable = selectedIds.filter((id) => !selected.has(id));
    const toDisable = Array.from(selected).filter((id) => !nextSelected.has(id));

    if (allAccess) {
      await setAllFoldersAccess(workspaceId, user.user_id, false);
    }
    await Promise.all([
      ...toEnable.map((id) => setFolderAccess(id, user.user_id, true)),
      ...toDisable.map((id) => setFolderAccess(id, user.user_id, false)),
    ]);

    setAllAccess(false);
    setSelected(nextSelected);
    setPickerOpen(false);
    router.refresh();
  }

  return (
    <li className="px-4 py-4">
      <div className="flex items-center gap-3">
        <Avatar name={user.full_name} />
        <div className="min-w-0 flex-1">
          <p className="truncate text-base font-medium text-gray-900">
            {user.full_name}
            {user.is_self ? (
              <span className="ml-1.5 text-xs font-normal text-gray-400">(You)</span>
            ) : null}
          </p>
          <RoleBadge role={user.role} />
        </div>
        {canRemove ? (
          <button
            type="button"
            onClick={handleRemove}
            disabled={busy}
            aria-label={`Remove ${user.full_name}`}
            className="grid h-9 w-9 shrink-0 place-items-center rounded-lg text-gray-400 active:bg-red-50 active:text-red-500 disabled:opacity-60"
          >
            <Trash2 className="h-4 w-4" />
          </button>
        ) : null}
      </div>

      {canManageRole ? (
        <div className="mt-3 flex items-center gap-2">
          <div
            role="group"
            aria-label={`Role for ${user.full_name}`}
            className="grid flex-1 grid-cols-2 gap-1 rounded-xl bg-gray-100 p-1"
          >
            {(["admin", "member"] as const).map((r) => (
              <button
                key={r}
                type="button"
                onClick={() => handleRoleChange(r)}
                disabled={busy}
                aria-pressed={user.role === r}
                className={`rounded-lg py-2 text-sm font-medium transition-colors disabled:opacity-60 ${
                  user.role === r
                    ? "bg-white text-gray-900 shadow-sm"
                    : "text-gray-500 active:text-gray-700"
                }`}
              >
                {r === "admin" ? "Administrator" : "Member"}
              </button>
            ))}
          </div>
          <button
            type="button"
            onClick={handleTransferOwnership}
            disabled={busy}
            className="shrink-0 rounded-xl border border-gray-200 px-3 py-2 text-sm font-medium text-gray-600 active:bg-gray-50 disabled:opacity-60"
          >
            Make owner
          </button>
        </div>
      ) : null}

      {error ? (
        <p className="mt-2 text-sm text-red-600" role="alert">
          {error}
        </p>
      ) : null}

      {targetIsAdminTier ? (
        <p className="mt-3 text-sm text-gray-500">Full access (via role)</p>
      ) : (
        <>
          {/* Folder access mode: Full / Selected only — no "None" (requirement 2) */}
          <div
            role="group"
            aria-label="Folder access"
            className="mt-3 grid grid-cols-2 gap-1 rounded-xl bg-gray-100 p-1"
          >
            {(["full", "selected"] as FolderAccessMode[]).map((m) => (
              <button
                key={m}
                type="button"
                onClick={() => changeMode(m)}
                disabled={busy}
                aria-pressed={mode === m}
                className={`rounded-lg py-2 text-sm font-medium transition-colors disabled:opacity-60 ${
                  mode === m
                    ? "bg-white text-gray-900 shadow-sm"
                    : "text-gray-500 active:text-gray-700"
                }`}
              >
                {m === "full" ? "Full" : "Selected"}
              </button>
            ))}
          </div>
          <p className="mt-1.5 text-sm text-gray-500">
            {mode === "full"
              ? "Full access"
              : `Selected folders (${selected.size})`}
          </p>
          {mode === "selected" ? (
            <button
              type="button"
              onClick={() => setPickerOpen(true)}
              disabled={busy}
              className="mt-2 text-sm font-medium text-brand active:text-brand-dark disabled:opacity-60"
            >
              Choose folders
            </button>
          ) : null}
        </>
      )}

      {pickerOpen ? (
        <FolderPickerModal
          folders={folders}
          initiallySelected={Array.from(selected)}
          onCancel={() => setPickerOpen(false)}
          onSave={savePickedFolders}
        />
      ) : null}
    </li>
  );
}

function Avatar({ name }: { name: string }) {
  const initial = name.trim().charAt(0).toUpperCase() || "?";
  return (
    <span className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-gray-200 text-sm font-semibold text-gray-600">
      {initial}
    </span>
  );
}
