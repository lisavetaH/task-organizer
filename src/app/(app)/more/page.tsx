import Link from "next/link";
import { Users, ChevronRight } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { isWorkspaceAdmin, type Membership } from "@/lib/types";
import { DangerZone, type OwnedWorkspace } from "@/components/more/DangerZone";

export const dynamic = "force-dynamic";

export default async function MorePage() {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  // Every membership (not just the first) — deleting an account must
  // correctly detect workspace ownership across all of them, not only a
  // "primary" one.
  const { data: memberships } = await supabase
    .from("workspace_members")
    .select("workspace_id, role, workspaces(name)")
    .order("joined_at", { ascending: true })
    .returns<(Membership & { workspaces: { name: string } | null })[]>();

  const membership = memberships?.[0];
  const isAdmin = membership ? isWorkspaceAdmin(membership.role) : false;

  const ownedWorkspaces: OwnedWorkspace[] = (memberships ?? [])
    .filter((m) => m.role === "owner")
    .map((m) => ({ id: m.workspace_id, name: m.workspaces?.name ?? "Untitled workspace" }));

  return (
    <main>
      <header className="sticky top-0 z-10 border-b border-gray-200 bg-white/90 px-4 py-4 backdrop-blur">
        <h1 className="text-xl font-bold text-gray-900">More</h1>
      </header>

      <section className="px-4 py-6">
        <div className="rounded-xl border border-gray-200 bg-white p-4">
          <p className="text-xs font-medium uppercase tracking-wide text-gray-400">
            Signed in as
          </p>
          <p className="mt-1 truncate text-sm text-gray-900">
            {user?.email ?? "—"}
          </p>
        </div>

        {isAdmin ? (
          <div className="mt-6 overflow-hidden rounded-xl border border-gray-200 bg-white">
            <Link
              href="/users"
              className="flex items-center gap-3 px-4 py-4 active:bg-gray-50"
            >
              <span className="grid h-9 w-9 place-items-center rounded-lg bg-brand/10 text-brand">
                <Users className="h-5 w-5" />
              </span>
              <span className="flex-1 text-base font-medium text-gray-900">
                Users &amp; access
              </span>
              <ChevronRight className="h-5 w-5 text-gray-300" />
            </Link>
          </div>
        ) : null}

        <DangerZone ownedWorkspaces={ownedWorkspaces} />
      </section>
    </main>
  );
}
