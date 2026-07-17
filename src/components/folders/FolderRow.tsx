"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import {
  GripVertical,
  ChevronRight,
  ChevronDown,
  MoreHorizontal,
  Check,
  Lock,
} from "lucide-react";
import type { Folder } from "@/lib/types";
import { resolveFolderIcon } from "@/lib/folder-icons";

export function FolderRow({
  folder,
  canManage,
  hasAccess,
  startInRename,
  onRenameCommit,
  onOpenSheet,
  onRenameHandled,
}: {
  folder: Folder;
  canManage: boolean;
  hasAccess: boolean;
  startInRename: boolean;
  onRenameCommit: (name: string) => void;
  onOpenSheet: () => void;
  onRenameHandled: () => void;
}) {
  const router = useRouter();
  const [expanded, setExpanded] = useState(false);
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
    <li
      ref={setNodeRef}
      style={style}
      className={`select-none border-b border-gray-100 bg-white ${
        isDragging ? "opacity-60 shadow-lg" : ""
      }`}
    >
      <div className="flex items-center gap-1 px-2">
        {/* Drag handle (admins only) */}
        {canManage ? (
          <button
            type="button"
            aria-label="Reorder"
            className="grid h-12 w-9 shrink-0 cursor-grab touch-none place-items-center text-gray-300 active:text-gray-500"
            {...attributes}
            {...listeners}
          >
            <GripVertical className="h-5 w-5" />
          </button>
        ) : (
          <span className="w-2" />
        )}

        {/* Expand / collapse */}
        <button
          type="button"
          aria-label={expanded ? "Collapse" : "Expand"}
          onClick={() => setExpanded((v) => !v)}
          className="grid h-12 w-8 shrink-0 place-items-center text-gray-400 active:text-gray-600"
        >
          {expanded ? (
            <ChevronDown className="h-5 w-5" />
          ) : (
            <ChevronRight className="h-5 w-5" />
          )}
        </button>

        {/* Icon */}
        <span
          className="grid h-9 w-9 shrink-0 place-items-center rounded-lg"
          style={{
            backgroundColor: folder.color ? `${folder.color}1a` : "#f3f4f6",
            color: folder.color ?? "#4b5563",
          }}
        >
          <Icon className="h-5 w-5" />
        </span>

        {/* Name / inline rename */}
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
            className="flex flex-1 items-center gap-2 py-3 pl-2 text-left active:text-brand"
          >
            <span className="flex-1 truncate text-base font-medium text-gray-900">
              {folder.name}
            </span>
            {!hasAccess ? (
              <span
                className="flex shrink-0 items-center gap-1 text-gray-400"
                aria-label="No access"
              >
                <Lock className="h-4 w-4" />
              </span>
            ) : null}
          </button>
        )}

        {/* Overflow menu (admins only) */}
        {canManage && !editing ? (
          <button
            type="button"
            aria-label="Folder options"
            onClick={onOpenSheet}
            className="grid h-12 w-11 shrink-0 place-items-center text-gray-400 active:text-gray-600"
          >
            <MoreHorizontal className="h-5 w-5" />
          </button>
        ) : (
          <span className="w-2" />
        )}
      </div>

      {/* Expanded body — folder contents live here in a later phase */}
      {expanded ? (
        <div className="px-14 pb-4 pt-1">
          <p className="text-sm text-gray-400">Nothing in this folder yet.</p>
        </div>
      ) : null}
    </li>
  );
}
