import { createClient } from "@/lib/supabase/server";
import { TrashView } from "@/components/items/TrashView";

export const dynamic = "force-dynamic";

export default async function FolderTrashPage({ params }: { params: { folderId: string } }) {
  const supabase = createClient();
  const { data: canEdit } = await supabase.rpc("folder_permission", {
    f_id: params.folderId, perm: "edit",
  });
  const { data: canCreate } = await supabase.rpc("folder_permission", {
    f_id: params.folderId, perm: "create",
  });
  return <TrashView folderId={params.folderId} canManage={!!canEdit || !!canCreate} />;
}
