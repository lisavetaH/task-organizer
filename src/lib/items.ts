import { createClient } from "@/lib/supabase/client";
import {
  PHOTO_BUCKET,
  ATTACHMENT_BUCKET,
  VOICE_BUCKET,
  type FolderItem,
  type FolderItemFull,
  type MediaRecord,
  type VoiceNote,
} from "@/lib/types";

const ITEM_COLUMNS =
  "id,workspace_id,folder_id,title,body,item_type,scheduled_date,scheduled_time,is_pinned,position,completed_at,completed_by,created_by,created_at,updated_at,archived_at";
const MEDIA_COLUMNS =
  "id,item_id,folder_id,storage_path,original_filename,mime_type,size_bytes,position,uploaded_by,created_at";
const VOICE_COLUMNS = `${MEDIA_COLUMNS},duration_seconds`;

// ------------------------------ Items ------------------------------

async function attachMediaAndMeta(rows: FolderItem[]): Promise<FolderItemFull[]> {
  const supabase = createClient();
  if (rows.length === 0) return [];
  const ids = rows.map((r) => r.id);

  const [{ data: photos }, { data: attachments }, { data: voices }, { data: favs }] =
    await Promise.all([
      supabase.from("folder_item_photos").select(MEDIA_COLUMNS).in("item_id", ids).order("position"),
      supabase.from("folder_item_attachments").select(MEDIA_COLUMNS).in("item_id", ids).order("position"),
      supabase.from("folder_item_voice_notes").select(VOICE_COLUMNS).in("item_id", ids).order("position"),
      supabase.from("user_favorite_items").select("item_id").in("item_id", ids),
    ]);

  const group = <T extends { item_id: string }>(list: T[] | null) => {
    const m = new Map<string, T[]>();
    for (const x of list ?? []) (m.get(x.item_id) ?? m.set(x.item_id, []).get(x.item_id)!).push(x);
    return m;
  };
  const p = group((photos ?? []) as MediaRecord[]);
  const a = group((attachments ?? []) as MediaRecord[]);
  const v = group((voices ?? []) as VoiceNote[]);
  const favSet = new Set((favs ?? []).map((f) => f.item_id as string));

  const userIds = Array.from(
    new Set(rows.flatMap((r) => [r.created_by, r.completed_by].filter(Boolean)))
  ) as string[];
  const nameById = new Map<string, string>();
  if (userIds.length) {
    const { data: profs } = await supabase.from("profiles").select("id, full_name").in("id", userIds);
    for (const pr of profs ?? []) nameById.set(pr.id as string, pr.full_name as string);
  }

  return rows.map((r) => ({
    ...r,
    photos: p.get(r.id) ?? [],
    attachments: a.get(r.id) ?? [],
    voice_notes: v.get(r.id) ?? [],
    is_favorite: favSet.has(r.id),
    creator_name: r.created_by ? nameById.get(r.created_by) ?? null : null,
    completer_name: r.completed_by ? nameById.get(r.completed_by) ?? null : null,
  }));
}

export async function listFolderItems(folderId: string): Promise<FolderItemFull[]> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("folder_items").select(ITEM_COLUMNS)
    .eq("folder_id", folderId).is("archived_at", null)
    .order("is_pinned", { ascending: false })
    .order("position", { ascending: true })
    .order("created_at", { ascending: false });
  if (error) throw new Error(error.message);
  return attachMediaAndMeta((data ?? []) as FolderItem[]);
}

export async function listTrash(folderId: string): Promise<FolderItemFull[]> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("folder_items").select(ITEM_COLUMNS)
    .eq("folder_id", folderId).not("archived_at", "is", null)
    .order("archived_at", { ascending: false });
  if (error) throw new Error(error.message);
  return attachMediaAndMeta((data ?? []) as FolderItem[]);
}

export interface NewItemInput {
  title?: string | null;
  body?: string | null;
  scheduled_date?: string | null;
  scheduled_time?: string | null;
}

export async function createItem(folderId: string, input: NewItemInput): Promise<FolderItem> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("folder_items")
    .insert({
      folder_id: folderId,
      title: input.title?.trim() || null,
      body: input.body?.trim() || null,
      scheduled_date: input.scheduled_date || null,
      scheduled_time: input.scheduled_time || null,
    })
    .select(ITEM_COLUMNS).single();
  if (error) throw new Error(error.message);
  return data as FolderItem;
}

export async function updateItem(id: string, patch: Partial<NewItemInput>): Promise<void> {
  const supabase = createClient();
  const clean: Record<string, unknown> = {};
  if (patch.title !== undefined) clean.title = patch.title?.trim() || null;
  if (patch.body !== undefined) clean.body = patch.body?.trim() || null;
  if (patch.scheduled_date !== undefined) clean.scheduled_date = patch.scheduled_date || null;
  if (patch.scheduled_time !== undefined) clean.scheduled_time = patch.scheduled_time || null;
  const { error } = await supabase.from("folder_items").update(clean).eq("id", id);
  if (error) throw new Error(error.message);
}

/** Clears an entry's calendar assignment (date + time) without touching the entry, its folder, or its media. */
export async function unscheduleItem(id: string): Promise<void> {
  return updateItem(id, { scheduled_date: null, scheduled_time: null });
}

export async function setItemCompleted(id: string, completed: boolean): Promise<void> {
  const supabase = createClient();
  const { error } = await supabase
    .from("folder_items")
    .update({ completed_at: completed ? new Date().toISOString() : null })
    .eq("id", id);
  if (error) throw new Error(error.message);
}

export async function setItemPinned(id: string, pinned: boolean): Promise<void> {
  const supabase = createClient();
  const { error } = await supabase.from("folder_items").update({ is_pinned: pinned }).eq("id", id);
  if (error) throw new Error(error.message);
}

export async function archiveItem(id: string): Promise<void> {
  const supabase = createClient();
  const { error } = await supabase
    .from("folder_items").update({ archived_at: new Date().toISOString() }).eq("id", id);
  if (error) throw new Error(error.message);
}

export async function restoreItem(id: string): Promise<void> {
  const supabase = createClient();
  const { error } = await supabase.from("folder_items").update({ archived_at: null }).eq("id", id);
  if (error) throw new Error(error.message);
}

export async function duplicateItem(id: string): Promise<void> {
  const supabase = createClient();
  const { error } = await supabase.rpc("duplicate_item", { p_item_id: id });
  if (error) throw new Error(error.message);
}

export async function reorderItems(folderId: string, orderedIds: string[]): Promise<void> {
  const supabase = createClient();
  const { error } = await supabase.rpc("reorder_items", { p_folder_id: folderId, p_ordered_ids: orderedIds });
  if (error) throw new Error(error.message);
}

export async function purgeItem(id: string): Promise<void> {
  const supabase = createClient();
  const { data, error } = await supabase.rpc("purge_item", { p_item_id: id });
  if (error) throw new Error(error.message);
  await removeStorageObjects((data ?? []) as { bucket: string; path: string }[]);
}

export async function emptyExpiredTrash(workspaceId: string): Promise<void> {
  const supabase = createClient();
  const { data, error } = await supabase.rpc("purge_expired_trash", { p_workspace_id: workspaceId });
  if (error) throw new Error(error.message);
  await removeStorageObjects((data ?? []) as { bucket: string; path: string }[]);
}

/** Empty ALL trash in a folder now (Empty Trash button). Requires edit/create. */
export async function emptyFolderTrash(folderId: string): Promise<void> {
  const supabase = createClient();
  const { data, error } = await supabase.rpc("empty_folder_trash", { p_folder_id: folderId });
  if (error) throw new Error(error.message);
  await removeStorageObjects((data ?? []) as { bucket: string; path: string }[]);
}

async function removeStorageObjects(rows: { bucket: string; path: string }[]) {
  if (rows.length === 0) return;
  const supabase = createClient();
  const byBucket = new Map<string, string[]>();
  for (const r of rows) (byBucket.get(r.bucket) ?? byBucket.set(r.bucket, []).get(r.bucket)!).push(r.path);
  for (const [bucket, paths] of byBucket) await supabase.storage.from(bucket).remove(paths);
}

// ---------------------------- Favorites ----------------------------

export async function setFavorite(itemId: string, on: boolean): Promise<void> {
  const supabase = createClient();
  const { data: auth } = await supabase.auth.getUser();
  const uid = auth.user?.id;
  if (!uid) throw new Error("Not signed in");
  if (on) {
    const { error } = await supabase.from("user_favorite_items").upsert({ user_id: uid, item_id: itemId });
    if (error) throw new Error(error.message);
  } else {
    const { error } = await supabase
      .from("user_favorite_items").delete().eq("user_id", uid).eq("item_id", itemId);
    if (error) throw new Error(error.message);
  }
}

export async function listFavorites(): Promise<FolderItemFull[]> {
  const supabase = createClient();
  const { data: favs, error } = await supabase.from("user_favorite_items").select("item_id");
  if (error) throw new Error(error.message);
  const ids = (favs ?? []).map((f) => f.item_id as string);
  if (ids.length === 0) return [];
  const { data: items } = await supabase
    .from("folder_items").select(ITEM_COLUMNS).in("id", ids).is("archived_at", null)
    .order("is_pinned", { ascending: false }).order("created_at", { ascending: false });
  return attachMediaAndMeta((items ?? []) as FolderItem[]);
}

// ------------------------------ Media ------------------------------

async function resizeImage(file: File, maxEdge = 2400): Promise<Blob> {
  if (!file.type.startsWith("image/")) return file;
  try {
    const bitmap = await createImageBitmap(file);
    const scale = Math.min(1, maxEdge / Math.max(bitmap.width, bitmap.height));
    if (scale >= 1) return file;
    const w = Math.round(bitmap.width * scale);
    const h = Math.round(bitmap.height * scale);
    const canvas = document.createElement("canvas");
    canvas.width = w; canvas.height = h;
    const ctx = canvas.getContext("2d");
    if (!ctx) return file;
    ctx.drawImage(bitmap, 0, 0, w, h);
    const blob: Blob | null = await new Promise((res) => canvas.toBlob((b) => res(b), "image/jpeg", 0.9));
    return blob ?? file;
  } catch {
    return file;
  }
}

function safeExt(name: string, type: string): string {
  const fromName = name.split(".").pop();
  if (fromName && fromName.length <= 6 && fromName !== name) return fromName.toLowerCase();
  const fromType = type.split("/").pop();
  return fromType || "bin";
}

async function uploadTo(
  bucket: string, table: string, columns: string,
  folderId: string, itemId: string,
  body: Blob, name: string, type: string, position: number,
  extra: Record<string, unknown> = {}
): Promise<MediaRecord> {
  const supabase = createClient();
  const uuid = crypto.randomUUID();
  const ext = body.type === "image/jpeg" && type.startsWith("image/") ? "jpg" : safeExt(name, body.type || type);
  const path = `${folderId}/${itemId}/${uuid}.${ext}`;

  const { error: upErr } = await supabase.storage.from(bucket).upload(path, body, {
    contentType: body.type || type || "application/octet-stream",
    upsert: false,
  });
  if (upErr) throw new Error(upErr.message);

  const { data, error } = await supabase
    .from(table)
    .insert({
      item_id: itemId, storage_path: path, original_filename: name,
      mime_type: body.type || type || null, size_bytes: body.size, position, ...extra,
    })
    .select(columns).single();
  if (error) {
    await supabase.storage.from(bucket).remove([path]);
    throw new Error(error.message);
  }
  return data as unknown as MediaRecord;
}

export async function uploadPhoto(folderId: string, itemId: string, file: File, position: number) {
  const blob = await resizeImage(file);
  return uploadTo(PHOTO_BUCKET, "folder_item_photos", MEDIA_COLUMNS, folderId, itemId, blob, file.name, file.type, position);
}

export async function uploadAttachment(folderId: string, itemId: string, file: File, position: number) {
  return uploadTo(ATTACHMENT_BUCKET, "folder_item_attachments", MEDIA_COLUMNS, folderId, itemId, file, file.name, file.type, position);
}

export async function uploadVoiceNote(
  folderId: string, itemId: string, blob: Blob, durationSeconds: number, position: number
) {
  return uploadTo(
    VOICE_BUCKET, "folder_item_voice_notes", VOICE_COLUMNS,
    folderId, itemId, blob, `voice-${Date.now()}.webm`, blob.type || "audio/webm", position,
    { duration_seconds: Math.round(durationSeconds) }
  ) as Promise<VoiceNote>;
}

export async function removeMedia(kind: "photo" | "attachment" | "voice", media: MediaRecord): Promise<void> {
  const supabase = createClient();
  const table = kind === "photo" ? "folder_item_photos" : kind === "attachment" ? "folder_item_attachments" : "folder_item_voice_notes";
  const bucket = kind === "photo" ? PHOTO_BUCKET : kind === "attachment" ? ATTACHMENT_BUCKET : VOICE_BUCKET;
  const { error } = await supabase.from(table).delete().eq("id", media.id);
  if (error) throw new Error(error.message);
  await supabase.storage.from(bucket).remove([media.storage_path]);
}

export async function reorderPhotos(itemId: string, orderedIds: string[]): Promise<void> {
  const supabase = createClient();
  const { error } = await supabase.rpc("reorder_photos", { p_item_id: itemId, p_ordered_ids: orderedIds });
  if (error) throw new Error(error.message);
}

export async function signUrls(bucket: string, media: MediaRecord[]): Promise<Record<string, string>> {
  if (media.length === 0) return {};
  const supabase = createClient();
  const { data, error } = await supabase.storage.from(bucket)
    .createSignedUrls(media.map((m) => m.storage_path), 60 * 60);
  if (error) return {};
  const map: Record<string, string> = {};
  (data ?? []).forEach((entry, i) => { if (entry.signedUrl) map[media[i].id] = entry.signedUrl; });
  return map;
}

export async function signDownloadUrl(bucket: string, path: string, filename?: string): Promise<string | null> {
  const supabase = createClient();
  const { data, error } = await supabase.storage.from(bucket)
    .createSignedUrl(path, 60 * 10, { download: filename ?? true });
  if (error) return null;
  return data?.signedUrl ?? null;
}
