import Link from "next/link";
import { ChevronLeft, Lock } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { FOLDER_METADATA_COLUMNS, type Folder } from "@/lib/types";
import { resolveFolderIcon } from "@/lib/folder-icons";
import { FolderContents } from "@/components/items/FolderContents";

export const dynamic = "force-dynamic";

function Header({ folder }: { folder: Folder }) {
  const Icon = resolveFolderIcon(folder.icon);
  return (
    <header className="sticky top-0 z-10 flex items-center gap-2 border-b border-gray-200 bg-white/90 px-2 py-3 backdrop-blur">
      <Link
        href="/folders"
        aria-label="Back to folders"
        className="grid h-10 w-10 place-items-center rounded-full text-gray-500 active:bg-gray-100"
      >
        <ChevronLeft className="h-6 w-6" />
      </Link>
      <span
        className="grid h-8 w-8 place-items-center rounded-lg"
        style={{
          backgroundColor: folder.color ? `${folder.color}1a` : "#f3f4f6",
          color: folder.color ?? "#4b5563",
        }}
      >
        <Icon className="h-5 w-5" />
      </span>
      <h1 className="truncate text-lg font-semibold text-gray-900">
        {folder.name}
      </h1>
    </header>
  );
}

function LockedBody() {
  return (
    <section className="flex flex-col items-center px-6 py-24 text-center">
      <span className="grid h-14 w-14 place-items-center rounded-full bg-gray-100 text-gray-400">
        <Lock className="h-7 w-7" />
      </span>
      <p className="mt-4 text-base font-semibold text-gray-900">No access</p>
      <p className="mx-auto mt-1 max-w-xs text-sm text-gray-500">
        You can see this folder, but its contents are private. Ask an
        administrator if you need access.
      </p>
    </section>
  );
}

export default async function FolderDetailPage({
  params,
}: {
  params: { folderId: string };
}) {
  const supabase = createClient();

  // Metadata is only visible to users with folder_permission(id,'view') —
  // migration 009 reverted 003's blanket workspace-member visibility.
  // Selecting only safe columns — never contents, never created_by.
  const { data: folder } = await supabase
    .from("folders")
    .select(FOLDER_METADATA_COLUMNS)
    .eq("id", params.folderId)
    .is("archived_at", null)
    .maybeSingle<Folder>();

  // No metadata row -> this user has no access to the folder at all (or it
  // doesn't exist). Show the locked screen (not a generic not-found), per spec.
  if (!folder) {
    return (
      <main>
        <header className="sticky top-0 z-10 flex items-center gap-2 border-b border-gray-200 bg-white/90 px-2 py-3 backdrop-blur">
          <Link
            href="/folders"
            aria-label="Back to folders"
            className="grid h-10 w-10 place-items-center rounded-full text-gray-500 active:bg-gray-100"
          >
            <ChevronLeft className="h-6 w-6" />
          </Link>
          <h1 className="text-lg font-semibold text-gray-900">Folder</h1>
        </header>
        <LockedBody />
      </main>
    );
  }

  // Does this user actually have view access to the CONTENTS?
  // folder_permission() is SECURITY DEFINER and granted to authenticated.
  const { data: canView } = await supabase.rpc("folder_permission", {
    f_id: params.folderId,
    perm: "view",
  });

  if (!canView) {
    // Metadata shown in the header; contents replaced by the locked screen.
    return (
      <main>
        <Header folder={folder} />
        <LockedBody />
      </main>
    );
  }

  // Access granted: resolve the finer-grained permissions for the toolbar.
  const [{ data: canCreate }, { data: canEdit }, { data: canComplete }] =
    await Promise.all([
      supabase.rpc("folder_permission", { f_id: params.folderId, perm: "create" }),
      supabase.rpc("folder_permission", { f_id: params.folderId, perm: "edit" }),
      supabase.rpc("folder_permission", { f_id: params.folderId, perm: "complete" }),
    ]);

  return (
    <main>
      <Header folder={folder} />
      <FolderContents
        folderId={folder.id}
        canCreate={!!canCreate}
        canEdit={!!canEdit}
        canComplete={!!canComplete}
      />
    </main>
  );
}
