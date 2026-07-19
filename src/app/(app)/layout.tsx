import type { ReactNode } from "react";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { BottomNav } from "@/components/BottomNav";
import { SetDisplayNamePrompt } from "@/components/users/SetDisplayNamePrompt";

/**
 * Layout for the authenticated application shell.
 *
 * Middleware already redirects unauthenticated users, but we re-check here
 * server-side as defense in depth: no protected screen renders without a
 * verified session.
 */
export default async function AppLayout({
  children,
}: {
  children: ReactNode;
}) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("full_name")
    .eq("id", user.id)
    .maybeSingle<{ full_name: string }>();

  const needsDisplayName = profile?.full_name === "New User";

  return (
    <div className="mx-auto flex min-h-dvh max-w-md flex-col bg-gray-50">
      <div className="flex-1 pb-nav">{children}</div>
      <BottomNav />
      {needsDisplayName ? <SetDisplayNamePrompt /> : null}
    </div>
  );
}
