"use client";

import { useState } from "react";
import Link from "next/link";
import { ChevronLeft, Check, ShieldCheck } from "lucide-react";
import type { Folder, Role } from "@/lib/types";
import type { Invitation } from "@/lib/invitations";
import { resolveFolderIcon } from "@/lib/folder-icons";
import { InvitationsPanel } from "./InvitationsPanel";
import {
  setAllFoldersAccess,
  setFolderAccess,
  clearAllFolderAccess,
} from "@/lib/access";

export interface WorkspaceUser {
  user_id: string;
  full_name: string;
  role: Role;
  all_folders_access: boolean;
  is_self: boolean;
}

type Mode = "all" | "selected" | "none";

function deriveMode(allAccess: boolean, selectedCount: number): Mode {
  if (allAccess) return "all";
  if (selectedCount > 0) return "selected";
  return "none";
}

export function UserAccessManager({
  workspaceId,
  users,
  folders,
  initialSelectedByUser,
  invitations,
}: {
  workspaceId: string;
  users: WorkspaceUser[];
  folders: Folder[];
  initialSelectedByUser: Record<string, string[]>;
  invitations: Invitation[];
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
          />
        ))}
      </ul>

      {users.length <= 1 ? (
        <p className="px-6 py-8 text-center text-sm text-gray-400">
          You&apos;re the only member so far. Invite workers to assign folder
          access.
        </p>
      ) : null}
    </main>
  );
}

function UserRow({
  user,
  workspaceId,
  folders,
  initialSelected,
}: {
  user: WorkspaceUser;
  workspaceId: string;
  folders: Folder[];
  initialSelected: string[];
}) {
  const [allAccess, setAllAccess] = useState(user.all_folders_access);
  const [selected, setSelected] = useState<Set<string>>(
    new Set(initialSelected)
  );
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const mode = deriveMode(allAccess, selected.size);

  // Admins always have full access via their role — not editable here.
  if (user.role === "admin") {
    return (
      <li className="flex items-center gap-3 px-4 py-4">
        <Avatar name={user.full_name} />
        <div className="min-w-0 flex-1">
          <p className="truncate text-base font-medium text-gray-900">
            {user.full_name}
            {user.is_self ? " (you)" : ""}
          </p>
          <p className="mt-0.5 flex items-center gap-1 text-sm text-brand">
            <ShieldCheck className="h-4 w-4" />
            Administrator — full access
          </p>
        </div>
      </li>
    );
  }

  async function changeMode(next: Mode) {
    if (busy || next === mode) return;
    setBusy(true);
    setError(null);
    const prevAll = allAccess;
    const prevSelected = new Set(selected);
    try {
      if (next === "all") {
        await setAllFoldersAccess(workspaceId, user.user_id, true);
        setAllAccess(true);
        setSelected(new Set()); // server clears per-folder rows
      } else if (next === "none") {
        await clearAllFolderAccess(workspaceId, user.user_id);
        setAllAccess(false);
        setSelected(new Set());
      } else {
        // selected: turn off full access; admin then picks folders below
        await setAllFoldersAccess(workspaceId, user.user_id, false);
        setAllAccess(false);
        // keep whatever folder rows already existed (usually none)
      }
    } catch (e) {
      setAllAccess(prevAll);
      setSelected(prevSelected);
      setError(e instanceof Error ? e.message : "Could not update access.");
    } finally {
      setBusy(false);
    }
  }

  async function toggleFolder(folderId: string) {
    if (busy) return;
    const enable = !selected.has(folderId);
    setBusy(true);
    setError(null);
    const prev = new Set(selected);
    // optimistic
    setSelected((s) => {
      const n = new Set(s);
      if (enable) n.add(folderId);
      else n.delete(folderId);
      return n;
    });
    try {
      await setFolderAccess(folderId, user.user_id, enable);
    } catch (e) {
      setSelected(prev);
      setError(e instanceof Error ? e.message : "Could not update folder.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <li className="px-4 py-4">
      <div className="flex items-center gap-3">
        <Avatar name={user.full_name} />
        <div className="min-w-0 flex-1">
          <p className="truncate text-base font-medium text-gray-900">
            {user.full_name}
          </p>
          <p className="mt-0.5 text-sm text-gray-500">{statusLabel(mode, selected.size)}</p>
        </div>
      </div>

      {/* Mode selector */}
      <div
        role="group"
        aria-label="Access mode"
        className="mt-3 grid grid-cols-3 gap-1 rounded-xl bg-gray-100 p-1"
      >
        {(["all", "selected", "none"] as Mode[]).map((m) => (
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
            {m === "all" ? "Full" : m === "selected" ? "Selected" : "None"}
          </button>
        ))}
      </div>

      {error ? (
        <p className="mt-2 text-sm text-red-600" role="alert">
          {error}
        </p>
      ) : null}

      {/* Folder checklist (Selected mode only) */}
      {mode === "selected" ? (
        <div className="mt-3 overflow-hidden rounded-xl border border-gray-200">
          {folders.length === 0 ? (
            <p className="px-4 py-4 text-sm text-gray-400">
              No folders exist yet.
            </p>
          ) : (
            <ul className="divide-y divide-gray-100">
              {folders.map((f) => {
                const Icon = resolveFolderIcon(f.icon);
                const on = selected.has(f.id);
                return (
                  <li key={f.id}>
                    <button
                      type="button"
                      onClick={() => toggleFolder(f.id)}
                      disabled={busy}
                      className="flex w-full items-center gap-3 px-4 py-3 text-left active:bg-gray-50 disabled:opacity-60"
                    >
                      <span
                        className="grid h-8 w-8 shrink-0 place-items-center rounded-lg"
                        style={{
                          backgroundColor: f.color ? `${f.color}1a` : "#f3f4f6",
                          color: f.color ?? "#4b5563",
                        }}
                      >
                        <Icon className="h-4 w-4" />
                      </span>
                      <span className="flex-1 truncate text-base text-gray-900">
                        {f.name}
                      </span>
                      <span
                        className={`grid h-6 w-6 shrink-0 place-items-center rounded-md border ${
                          on
                            ? "border-brand bg-brand text-white"
                            : "border-gray-300 text-transparent"
                        }`}
                      >
                        <Check className="h-4 w-4" />
                      </span>
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      ) : null}
    </li>
  );
}

function statusLabel(mode: Mode, count: number): string {
  if (mode === "all") return "Full access to all folders";
  if (mode === "selected")
    return `Access to ${count} folder${count === 1 ? "" : "s"}`;
  return "No folder access";
}

function Avatar({ name }: { name: string }) {
  const initial = name.trim().charAt(0).toUpperCase() || "?";
  return (
    <span className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-gray-200 text-sm font-semibold text-gray-600">
      {initial}
    </span>
  );
}
