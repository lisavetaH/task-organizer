import Link from "next/link";
import { ChevronLeft, ShieldAlert } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import {
  FOLDER_METADATA_COLUMNS,
  isWorkspaceAdmin,
  type Folder,
  type Membership,
} from "@/lib/types";
import type { Invitation } from "@/lib/invitations";
import { UserAccessManager, type WorkspaceUser } from "@/components/users/UserAccessManager";

export const dynamic = "force-dynamic";

export default async function UsersPage() {
  const supabase = createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { data: membership } = await supabase
    .from("workspace_members")
    .select("workspace_id, role")
    .order("joined_at", { ascending: true })
    .limit(1)
    .maybeSingle<Membership>();

  // Admin-only screen. Non-admins get a clear notice (defense in depth — every
  // mutating RPC also re-checks admin status server-side).
  if (!membership || !isWorkspaceAdmin(membership.role)) {
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
          <h1 className="text-lg font-semibold text-gray-900">Users</h1>
        </header>
        <section className="flex flex-col items-center px-6 py-24 text-center">
          <span className="grid h-14 w-14 place-items-center rounded-full bg-gray-100 text-gray-400">
            <ShieldAlert className="h-7 w-7" />
          </span>
          <p className="mt-4 text-base font-semibold text-gray-900">
            Admins only
          </p>
          <p className="mx-auto mt-1 max-w-xs text-sm text-gray-500">
            Only workspace administrators can manage users and permissions.
          </p>
        </section>
      </main>
    );
  }

  const workspaceId = membership.workspace_id;

  // Members of the workspace.
  const { data: memberRows } = await supabase
    .from("workspace_members")
    .select("user_id, role, all_folders_access")
    .eq("workspace_id", workspaceId)
    .order("joined_at", { ascending: true });

  const memberIds = (memberRows ?? []).map((m) => m.user_id as string);

  // Names for those members (profiles RLS allows shared-workspace reads).
  const { data: profileRows } = await supabase
    .from("profiles")
    .select("id, full_name")
    .in("id", memberIds.length ? memberIds : ["00000000-0000-0000-0000-000000000000"]);

  const nameById = new Map<string, string>(
    (profileRows ?? []).map((p) => [p.id as string, p.full_name as string])
  );

  // All folders in the workspace (metadata only).
  const { data: folderRows } = await supabase
    .from("folders")
    .select(FOLDER_METADATA_COLUMNS)
    .eq("workspace_id", workspaceId)
    .is("archived_at", null)
    .order("position", { ascending: true })
    .order("created_at", { ascending: true });

  const folders = (folderRows ?? []) as Folder[];
  const folderIds = folders.map((f) => f.id);

  // Current per-folder grants (admin can read all via is_folder_admin).
  const { data: grantRows } = folderIds.length
    ? await supabase
        .from("folder_members")
        .select("folder_id, user_id, can_view")
        .in("folder_id", folderIds)
    : { data: [] as { folder_id: string; user_id: string; can_view: boolean }[] };

  const selectedByUser: Record<string, string[]> = {};
  for (const g of grantRows ?? []) {
    if (!g.can_view) continue;
    (selectedByUser[g.user_id as string] ??= []).push(g.folder_id as string);
  }

  const users: WorkspaceUser[] = (memberRows ?? []).map((m) => ({
    user_id: m.user_id as string,
    full_name: nameById.get(m.user_id as string) ?? "Unknown",
    role: m.role as WorkspaceUser["role"],
    all_folders_access: Boolean(m.all_folders_access),
    is_self: m.user_id === user?.id,
  }));

  // Invitations for this workspace (admin RLS select).
  const { data: inviteRows } = await supabase
    .from("invitations")
    .select("id, email, role, status, expires_at, accepted_at, created_at")
    .eq("workspace_id", workspaceId)
    .order("created_at", { ascending: false });

  const invitations = (inviteRows ?? []) as Invitation[];

  return (
    <UserAccessManager
      workspaceId={workspaceId}
      users={users}
      folders={folders}
      initialSelectedByUser={selectedByUser}
      invitations={invitations}
      viewerRole={membership.role}
    />
  );
}
