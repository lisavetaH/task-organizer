"use client";

import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import { ChevronLeft, RotateCcw, Trash2 } from "lucide-react";
import type { FolderItemFull } from "@/lib/types";
import { listTrash, restoreItem, purgeItem, emptyFolderTrash } from "@/lib/items";
import { LoadingState } from "@/components/LoadingState";

const RETENTION_DAYS = 30;

function daysLeft(archivedAt: string): number {
  const deleted = new Date(archivedAt).getTime();
  const expires = deleted + RETENTION_DAYS * 86400_000;
  return Math.max(0, Math.ceil((expires - Date.now()) / 86400_000));
}

export function TrashView({
  folderId,
  canManage,
}: {
  folderId: string;
  canManage: boolean;
}) {
  const [items, setItems] = useState<FolderItemFull[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      setItems(await listTrash(folderId));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not load trash.");
      setItems([]);
    }
  }, [folderId]);

  useEffect(() => {
    load();
  }, [load]);

  async function onRestore(item: FolderItemFull) {
    setItems((prev) => (prev ?? []).filter((i) => i.id !== item.id));
    try {
      await restoreItem(item.id);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not restore.");
      load();
    }
  }

  async function onPurge(item: FolderItemFull) {
    if (!confirm("Permanently delete this entry and its files? This cannot be undone.")) return;
    setItems((prev) => (prev ?? []).filter((i) => i.id !== item.id));
    try {
      await purgeItem(item.id);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not delete.");
      load();
    }
  }

  async function onEmptyAll() {
    if (!confirm("Permanently delete everything in Trash and its files? This cannot be undone.")) return;
    setItems([]);
    try {
      await emptyFolderTrash(folderId);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not empty trash.");
      load();
    }
  }

  return (
    <main>
      <header className="sticky top-0 z-10 flex items-center gap-2 border-b border-gray-200 bg-white/90 px-2 py-3 backdrop-blur">
        <Link
          href={`/folders/${folderId}`}
          aria-label="Back"
          className="grid h-10 w-10 place-items-center rounded-full text-gray-500 active:bg-gray-100"
        >
          <ChevronLeft className="h-6 w-6" />
        </Link>
        <h1 className="text-lg font-semibold text-gray-900">Trash</h1>
        {canManage && items && items.length > 0 ? (
          <button
            type="button"
            onClick={onEmptyAll}
            className="ml-auto rounded-lg px-3 py-2 text-sm font-semibold text-red-600 active:bg-red-50"
          >
            Empty Trash
          </button>
        ) : null}
      </header>

      {error ? (
        <div className="mx-4 mt-3 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</div>
      ) : null}

      {items === null ? (
        <LoadingState label="Loading trash…" />
      ) : items.length === 0 ? (
        <section className="px-6 py-20 text-center">
          <p className="text-base font-medium text-gray-900">Trash is empty</p>
          <p className="mx-auto mt-1 max-w-xs text-sm text-gray-500">
            Deleted entries stay here for {RETENTION_DAYS} days, then are removed
            automatically.
          </p>
        </section>
      ) : (
        <ul className="divide-y divide-gray-100">
          {items.map((item) => {
            const left = item.archived_at ? daysLeft(item.archived_at) : 0;
            const deletedOn = item.archived_at
              ? new Date(item.archived_at).toLocaleDateString(undefined, {
                  month: "short",
                  day: "numeric",
                  year: "numeric",
                })
              : "";
            return (
              <li key={item.id} className="px-4 py-3">
                <p className="truncate text-base font-medium text-gray-900">
                  {item.title || item.body || "Untitled"}
                </p>
                <p className="mt-0.5 text-xs text-gray-400">
                  Deleted {deletedOn} · {left} day{left === 1 ? "" : "s"} left
                </p>
                <div className="mt-2 flex gap-2">
                  <button
                    type="button"
                    onClick={() => onRestore(item)}
                    className="flex items-center gap-1.5 rounded-lg border border-gray-200 px-3 py-2 text-sm font-medium text-gray-700 active:bg-gray-50"
                  >
                    <RotateCcw className="h-4 w-4" />
                    Restore
                  </button>
                  {canManage ? (
                    <button
                      type="button"
                      onClick={() => onPurge(item)}
                      className="flex items-center gap-1.5 rounded-lg border border-gray-200 px-3 py-2 text-sm font-medium text-red-600 active:bg-red-50"
                    >
                      <Trash2 className="h-4 w-4" />
                      Delete permanently
                    </button>
                  ) : null}
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </main>
  );
}
