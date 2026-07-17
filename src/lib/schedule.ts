import { createClient } from "@/lib/supabase/client";
import type { FolderItem } from "@/lib/types";

export interface ScheduledItem extends FolderItem {
  folder_name: string;
  folder_color: string | null;
  folder_icon: string | null;
}

/**
 * Items scheduled within [startYmd, endYmd] (inclusive) across every folder
 * the user can view. RLS on folder_items already restricts to accessible
 * folders, so a plain query returns only permitted rows.
 */
export async function scheduledItemsInRange(
  workspaceId: string,
  startYmd: string,
  endYmd: string
): Promise<ScheduledItem[]> {
  const supabase = createClient();

  const { data: items, error } = await supabase
    .from("folder_items")
    .select(
      "id,workspace_id,folder_id,title,body,item_type,scheduled_date,scheduled_time,is_pinned,position,completed_at,completed_by,created_by,created_at,updated_at,archived_at"
    )
    .eq("workspace_id", workspaceId)
    .is("archived_at", null)
    .not("scheduled_date", "is", null)
    .gte("scheduled_date", startYmd)
    .lte("scheduled_date", endYmd)
    .order("is_pinned", { ascending: false })
    .order("scheduled_time", { ascending: true, nullsFirst: true });

  if (error) throw new Error(error.message);
  const rows = (items ?? []) as FolderItem[];
  if (rows.length === 0) return [];

  // Attach folder metadata (visible to any member via migration 003).
  const folderIds = Array.from(new Set(rows.map((r) => r.folder_id)));
  const { data: folders } = await supabase
    .from("folders")
    .select("id,name,color,icon")
    .in("id", folderIds);
  type FolderMeta = { name: string; color: string | null; icon: string | null };
  const meta = new Map<string, FolderMeta>(
    (folders ?? []).map((f) => [
      f.id as string,
      {
        name: f.name as string,
        color: (f.color as string | null) ?? null,
        icon: (f.icon as string | null) ?? null,
      },
    ])
  );

  return rows.map((r) => ({
    ...r,
    folder_name: meta.get(r.folder_id)?.name ?? "Folder",
    folder_color: meta.get(r.folder_id)?.color ?? null,
    folder_icon: meta.get(r.folder_id)?.icon ?? null,
  }));
}
