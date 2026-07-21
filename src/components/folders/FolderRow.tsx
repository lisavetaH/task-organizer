"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { GripVertical, MoreHorizontal, Check } from "lucide-react";
import type { Folder } from "@/lib/types";
import { resolveFolderIcon } from "@/lib/folder-icons";

/**
 * A large, tappable folder card. The icon+name area is the only thing that
 * opens the folder — the drag handle and overflow menu are separate
 * controls next to it, not nested inside it, so dragging or opening the
 * menu never triggers navigation.
 */
export function FolderRow({
  folder,
  canManage,
  startInRename,
  onRenameCommit,
  onOpenSheet,
  onRenameHandled,
}: {
  folder: Folder;
  canManage: boolean;
  startInRename: boolean;
  onRenameCommit: (name: string) => void;
  onOpenSheet: () => void;
  onRenameHandled: () => void;
}) {
  const router = useRouter();
  const [editing, setEditing] = useState(startInRename);
  const [draft, setDraft] = useState(folder.name);
  const inputRef = useRef<HTMLInputElement>(null);

  const { attributes, listeners, setNodeRef, transform, transition, isDragging } =
    useSortable({ id: folder.id, disabled: !canManage });

  useEffect(() => {
    if (startInRename) {
      setEditing(true);
      setDraft(folder.name);
    }
  }, [startInRename, folder.name]);

  useEffect(() => {
    if (editing) {
      // focus + select on entering edit mode
      const id = window.setTimeout(() => {
        inputRef.current?.focus();
        inputRef.current?.select();
      }, 10);
      return () => window.clearTimeout(id);
    }
  }, [editing]);

  const Icon = resolveFolderIcon(folder.icon);

  function commit() {
    const next = draft.trim();
    setEditing(false);
    onRenameHandled();
    if (next && next !== folder.name) {
      onRenameCommit(next);
    } else {
      setDraft(folder.name); // revert blank/no-op edits
    }
  }

  function cancel() {
    setEditing(false);
    setDraft(folder.name);
    onRenameHandled();
  }

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  return (
    <li ref={setNodeRef} style={style} className={isDragging ? "opacity-60" : ""}>
      <div className="flex items-center gap-1 rounded-2xl border border-gray-100 bg-white p-2 shadow-sm">
        {/* Drag handle (admins only) — reorders, never opens the folder */}
        {canManage ? (
          <button
            type="button"
            aria-label="Reorder"
            className="grid h-14 w-9 shrink-0 cursor-grab touch-none place-items-center text-gray-300 active:text-gray-500"
            {...attributes}
            {...listeners}
          >
            <GripVertical className="h-5 w-5" />
          </button>
        ) : null}

        {editing ? (
          <div className="flex flex-1 items-center gap-2 py-2 pl-2">
            <input
              ref={inputRef}
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") commit();
                if (e.key === "Escape") cancel();
              }}
              onBlur={commit}
              maxLength={120}
              className="min-w-0 flex-1 rounded-lg border border-brand px-3 py-2 text-base outline-none focus:ring-1 focus:ring-brand"
              placeholder="Folder name"
            />
            <button
              type="button"
              onClick={commit}
              aria-label="Save name"
              className="grid h-10 w-10 shrink-0 place-items-center rounded-lg bg-brand text-white active:bg-brand-dark"
            >
              <Check className="h-5 w-5" />
            </button>
          </div>
        ) : (
          <button
            type="button"
            onClick={() => router.push(`/folders/${folder.id}`)}
            className="flex flex-1 items-center gap-3 rounded-xl py-3 pl-2 pr-2 text-left active:bg-gray-50"
          >
            <span
              className="grid h-12 w-12 shrink-0 place-items-center rounded-xl"
              style={{
                backgroundColor: folder.color ? `${folder.color}1a` : "#f3f4f6",
                color: folder.color ?? "#4b5563",
              }}
            >
              <Icon className="h-6 w-6" />
            </span>
            <span className="flex-1 truncate text-lg font-semibold text-gray-900">
              {folder.name}
            </span>
          </button>
        )}

        {/* Overflow menu (admins only) — independent of the open-folder tap */}
        {canManage && !editing ? (
          <button
            type="button"
            aria-label="Folder options"
            onClick={onOpenSheet}
            className="grid h-14 w-11 shrink-0 place-items-center text-gray-400 active:text-gray-600"
          >
            <MoreHorizontal className="h-5 w-5" />
          </button>
        ) : null}
      </div>
    </li>
  );
}
