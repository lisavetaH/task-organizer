import Link from "next/link";
import { LogOut, Users, ChevronRight } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { logOut } from "@/lib/auth-actions";
import { isWorkspaceAdmin, type Membership } from "@/lib/types";

export const dynamic = "force-dynamic";

export default async function MorePage() {
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

  const isAdmin = membership ? isWorkspaceAdmin(membership.role) : false;

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

        <form action={logOut} className="mt-6">
          <button
            type="submit"
            className="flex w-full items-center justify-center gap-2 rounded-xl border border-gray-200 bg-white px-4 py-3 text-sm font-semibold text-red-600 active:bg-gray-50"
          >
            <LogOut className="h-4 w-4" aria-hidden="true" />
            Log out
          </button>
        </form>
      </section>
    </main>
  );
}
