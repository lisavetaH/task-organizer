"use client";

import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import { Plus, Pencil, Trash2, Copy, Pin, PinOff, Trash, X } from "lucide-react";
import type { FolderItemFull } from "@/lib/types";
import { PHOTO_BUCKET, VOICE_BUCKET } from "@/lib/types";
import {
  listFolderItems, signUrls, setItemCompleted, setItemPinned, archiveItem,
  duplicateItem, setFavorite,
} from "@/lib/items";
import { ItemCard } from "./ItemCard";
import { ItemEditor } from "./ItemEditor";
import { LoadingState } from "@/components/LoadingState";

export function FolderContents({
  folderId,
  canCreate,
  canEdit,
  canComplete,
}: {
  folderId: string;
  canCreate: boolean;
  canEdit: boolean;
  canComplete: boolean;
}) {
  const [items, setItems] = useState<FolderItemFull[] | null>(null);
  const [photoUrls, setPhotoUrls] = useState<Record<string, string>>({});
  const [voiceUrls, setVoiceUrls] = useState<Record<string, string>>({});
  const [editing, setEditing] = useState<FolderItemFull | null>(null);
  const [creating, setCreating] = useState(false);
  const [menuFor, setMenuFor] = useState<FolderItemFull | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const rows = await listFolderItems(folderId);
      setItems(rows);
      setPhotoUrls(await signUrls(PHOTO_BUCKET, rows.flatMap((r) => r.photos)));
      setVoiceUrls(await signUrls(VOICE_BUCKET, rows.flatMap((r) => r.voice_notes)));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not load items.");
      setItems([]);
    }
  }, [folderId]);

  useEffect(() => { load(); }, [load]);

  async function toggleComplete(item: FolderItemFull) {
    const done = !!item.completed_at;
    setItems((prev) => (prev ?? []).map((i) => i.id === item.id ? { ...i, completed_at: done ? null : new Date().toISOString() } : i));
    try { await setItemCompleted(item.id, !done); await load(); }
    catch (e) { setError(e instanceof Error ? e.message : "Could not update."); load(); }
  }

  async function toggleFavorite(item: FolderItemFull) {
    setItems((prev) => (prev ?? []).map((i) => i.id === item.id ? { ...i, is_favorite: !i.is_favorite } : i));
    try { await setFavorite(item.id, !item.is_favorite); }
    catch (e) { setError(e instanceof Error ? e.message : "Could not update favorite."); load(); }
  }

  async function togglePin(item: FolderItemFull) {
    setMenuFor(null);
    try { await setItemPinned(item.id, !item.is_pinned); await load(); }
    catch (e) { setError(e instanceof Error ? e.message : "Could not pin."); }
  }

  async function onDuplicate(item: FolderItemFull) {
    setMenuFor(null);
    try { await duplicateItem(item.id); await load(); }
    catch (e) { setError(e instanceof Error ? e.message : "Could not duplicate."); }
  }

  async function onDelete(item: FolderItemFull) {
    setMenuFor(null);
    setItems((prev) => (prev ?? []).filter((i) => i.id !== item.id));
    try { await archiveItem(item.id); }
    catch (e) { setError(e instanceof Error ? e.message : "Could not delete."); load(); }
  }

  if (items === null) return <LoadingState label="Loading entries…" />;

  return (
    <>
      {error ? (
        <div className="mx-4 mt-3 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</div>
      ) : null}

      <div className="flex items-center justify-end px-4 pt-2">
        <Link href={`/folders/${folderId}/trash`} className="flex items-center gap-1 text-sm text-gray-400 active:text-gray-600">
          <Trash className="h-4 w-4" /> Trash
        </Link>
      </div>

      {items.length === 0 ? (
        <section className="px-6 py-16 text-center">
          <p className="text-base font-medium text-gray-900">Nothing here yet</p>
          <p className="mx-auto mt-1 max-w-xs text-sm text-gray-500">
            {canCreate ? "Add your first entry — notes, photos, files, or a voice note." : "Entries added to this folder will show up here."}
          </p>
          {canCreate ? (
            <button type="button" onClick={() => setCreating(true)}
              className="mt-5 inline-flex items-center gap-2 rounded-xl bg-brand px-4 py-3 text-sm font-semibold text-white active:bg-brand-dark">
              <Plus className="h-4 w-4" /> New entry
            </button>
          ) : null}
        </section>
      ) : (
        <ul className="pb-24">
          {items.map((item) => (
            <ItemCard key={item.id} item={item} photoUrls={photoUrls} voiceUrls={voiceUrls}
              canComplete={canComplete} canEdit={canEdit}
              onToggleComplete={() => toggleComplete(item)}
              onToggleFavorite={() => toggleFavorite(item)}
              onOpenMenu={() => setMenuFor(item)} />
          ))}
        </ul>
      )}

      {canCreate && items.length > 0 ? (
        <button type="button" onClick={() => setCreating(true)} aria-label="New entry"
          className="fixed right-5 z-20 grid h-14 w-14 place-items-center rounded-full bg-brand text-white shadow-lg active:bg-brand-dark"
          style={{ bottom: "calc(5rem + env(safe-area-inset-bottom))" }}>
          <Plus className="h-6 w-6" />
        </button>
      ) : null}

      {creating ? (
        <ItemEditor folderId={folderId} photoUrls={{}} voiceUrls={{}} onClose={() => setCreating(false)} onSaved={() => { setCreating(false); load(); }} />
      ) : null}
      {editing ? (
        <ItemEditor folderId={folderId} existing={editing} photoUrls={photoUrls} voiceUrls={voiceUrls}
          onClose={() => setEditing(null)} onSaved={() => { setEditing(null); load(); }} />
      ) : null}

      {menuFor ? (
        <div className="fixed inset-0 z-40 flex flex-col justify-end">
          <button type="button" aria-label="Close" onClick={() => setMenuFor(null)} className="absolute inset-0 bg-black/40" />
          <div className="relative z-10 rounded-t-2xl bg-white p-2" style={{ paddingBottom: "calc(0.5rem + env(safe-area-inset-bottom))" }}>
            <SheetBtn icon={<Pencil className="h-5 w-5 text-gray-500" />} label="Edit" onClick={() => { setEditing(menuFor); setMenuFor(null); }} />
            <SheetBtn icon={menuFor.is_pinned ? <PinOff className="h-5 w-5 text-gray-500" /> : <Pin className="h-5 w-5 text-gray-500" />}
              label={menuFor.is_pinned ? "Unpin" : "Pin"} onClick={() => togglePin(menuFor)} />
            <SheetBtn icon={<Copy className="h-5 w-5 text-gray-500" />} label="Duplicate" onClick={() => onDuplicate(menuFor)} />
            <SheetBtn icon={<Trash2 className="h-5 w-5" />} label="Delete" danger onClick={() => onDelete(menuFor)} />
            <SheetBtn icon={<X className="h-5 w-5 text-gray-500" />} label="Cancel" onClick={() => setMenuFor(null)} />
          </div>
        </div>
      ) : null}
    </>
  );
}

function SheetBtn({ icon, label, onClick, danger }: { icon: React.ReactNode; label: string; onClick: () => void; danger?: boolean }) {
  return (
    <button type="button" onClick={onClick}
      className={`flex w-full items-center gap-3 rounded-xl px-4 py-3.5 text-left text-base font-medium active:bg-gray-50 ${danger ? "text-red-600" : "text-gray-900"}`}>
      {icon}{label}
    </button>
  );
}
