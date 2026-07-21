"use client";

import { useState } from "react";
import Link from "next/link";
import { Plus, Search } from "lucide-react";
import {
  DndContext,
  closestCenter,
  PointerSensor,
  KeyboardSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
  arrayMove,
} from "@dnd-kit/sortable";
import type { Folder } from "@/lib/types";
import {
  archiveFolder,
  createFolder,
  renameFolder,
  reorderFolders,
  updateFolderMeta,
} from "@/lib/folders";
import { FolderRow } from "./FolderRow";
import { FolderActionSheet } from "./FolderActionSheet";

export function FolderManager({
  workspaceId,
  canManage,
  initialFolders,
}: {
  workspaceId: string;
  canManage: boolean;
  initialFolders: Folder[];
}) {
  const [folders, setFolders] = useState<Folder[]>(initialFolders);
  const [renamingId, setRenamingId] = useState<string | null>(null);
  const [sheetId, setSheetId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  const sheetFolder = folders.find((f) => f.id === sheetId) ?? null;

  async function handleCreate() {
    if (creating) return;
    setError(null);
    setCreating(true);
    const nextPosition =
      folders.reduce((max, f) => Math.max(max, f.position), -1) + 1;
    try {
      const created = await createFolder(workspaceId, "New folder", nextPosition);
      setFolders((prev) => [...prev, created]);
      setRenamingId(created.id); // enter rename immediately
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not create folder.");
    } finally {
      setCreating(false);
    }
  }

  async function handleRename(id: string, name: string) {
    const prev = folders;
    setFolders((fs) => fs.map((f) => (f.id === id ? { ...f, name } : f)));
    try {
      await renameFolder(id, name);
    } catch (e) {
      setFolders(prev); // revert
      setError(e instanceof Error ? e.message : "Could not rename folder.");
    }
  }

  async function handleColor(id: string, color: string | null) {
    const prev = folders;
    setFolders((fs) => fs.map((f) => (f.id === id ? { ...f, color } : f)));
    try {
      await updateFolderMeta(id, { color });
    } catch (e) {
      setFolders(prev);
      setError(e instanceof Error ? e.message : "Could not update color.");
    }
  }

  async function handleIcon(id: string, icon: string | null) {
    const prev = folders;
    setFolders((fs) => fs.map((f) => (f.id === id ? { ...f, icon } : f)));
    try {
      await updateFolderMeta(id, { icon });
    } catch (e) {
      setFolders(prev);
      setError(e instanceof Error ? e.message : "Could not update icon.");
    }
  }

  async function handleDelete(id: string) {
    const prev = folders;
    setSheetId(null);
    setFolders((fs) => fs.filter((f) => f.id !== id));
    try {
      await archiveFolder(id);
    } catch (e) {
      setFolders(prev);
      setError(e instanceof Error ? e.message : "Could not delete folder.");
    }
  }

  async function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    if (!over || active.id === over.id) return;

    const oldIndex = folders.findIndex((f) => f.id === active.id);
    const newIndex = folders.findIndex((f) => f.id === over.id);
    if (oldIndex < 0 || newIndex < 0) return;

    const prev = folders;
    const next = arrayMove(folders, oldIndex, newIndex).map((f, i) => ({
      ...f,
      position: i,
    }));
    setFolders(next);
    try {
      await reorderFolders(
        workspaceId,
        next.map((f) => f.id)
      );
    } catch (e) {
      setFolders(prev);
      setError(e instanceof Error ? e.message : "Could not save new order.");
    }
  }

  return (
    <main>
      <header className="sticky top-0 z-10 flex items-center justify-between border-b border-gray-200 bg-white/90 px-4 py-4 backdrop-blur">
        <h1 className="text-xl font-bold text-gray-900">Folders</h1>
        <div className="flex items-center gap-2">
          <Link
            href="/search"
            aria-label="Search"
            className="grid h-10 w-10 place-items-center rounded-full text-gray-500 active:bg-gray-100"
          >
            <Search className="h-5 w-5" />
          </Link>
          {canManage ? (
            <button
              type="button"
              onClick={handleCreate}
              disabled={creating}
              aria-label="New folder"
              className="grid h-10 w-10 place-items-center rounded-full bg-brand text-white active:bg-brand-dark disabled:opacity-60"
            >
              <Plus className="h-5 w-5" />
            </button>
          ) : null}
        </div>
      </header>

      {error ? (
        <div className="mx-4 mt-3 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">
          {error}
        </div>
      ) : null}

      {folders.length === 0 ? (
        <section className="px-6 py-20 text-center">
          <p className="text-base font-medium text-gray-900">No folders yet</p>
          <p className="mx-auto mt-1 max-w-xs text-sm text-gray-500">
            {canManage
              ? "Tap + to create your first folder, then name it whatever you like."
              : "You haven’t been given access to any folders yet."}
          </p>
        </section>
      ) : (
        <DndContext
          sensors={sensors}
          collisionDetection={closestCenter}
          onDragEnd={handleDragEnd}
        >
          <SortableContext
            items={folders.map((f) => f.id)}
            strategy={verticalListSortingStrategy}
          >
            <ul className="flex flex-col gap-3 px-4 pb-6 pt-3">
              {folders.map((folder) => (
                <FolderRow
                  key={folder.id}
                  folder={folder}
                  canManage={canManage}
                  startInRename={renamingId === folder.id}
                  onRenameHandled={() =>
                    setRenamingId((id) => (id === folder.id ? null : id))
                  }
                  onRenameCommit={(name) => handleRename(folder.id, name)}
                  onOpenSheet={() => setSheetId(folder.id)}
                />
              ))}
            </ul>
          </SortableContext>
        </DndContext>
      )}

      {sheetFolder ? (
        <FolderActionSheet
          folder={sheetFolder}
          onClose={() => setSheetId(null)}
          onColor={(c) => handleColor(sheetFolder.id, c)}
          onIcon={(i) => handleIcon(sheetFolder.id, i)}
          onDelete={() => handleDelete(sheetFolder.id)}
        />
      ) : null}
    </main>
  );
}
