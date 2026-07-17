"use client";

import { useState } from "react";
import { X, Trash2 } from "lucide-react";
import { FOLDER_COLORS, FOLDER_ICONS, type Folder } from "@/lib/types";
import { resolveFolderIcon } from "@/lib/folder-icons";

/**
 * A mobile bottom sheet for editing a single folder. Large touch targets,
 * reachable one-handed. Rename is inline in the folder row, so this sheet
 * focuses on color, icon, and delete.
 */
export function FolderActionSheet({
  folder,
  onClose,
  onColor,
  onIcon,
  onDelete,
}: {
  folder: Folder;
  onClose: () => void;
  onColor: (color: string | null) => void;
  onIcon: (icon: string | null) => void;
  onDelete: () => void;
}) {
  const [confirmDelete, setConfirmDelete] = useState(false);

  return (
    <div className="fixed inset-0 z-40 flex flex-col justify-end">
      {/* Scrim */}
      <button
        type="button"
        aria-label="Close"
        onClick={onClose}
        className="absolute inset-0 bg-black/40"
      />

      {/* Sheet */}
      <div
        className="relative z-10 rounded-t-2xl bg-white"
        style={{ paddingBottom: "calc(1rem + env(safe-area-inset-bottom))" }}
      >
        <div className="flex items-center justify-between px-5 py-4">
          <h2 className="truncate pr-3 text-base font-semibold text-gray-900">
            {folder.name}
          </h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="grid h-9 w-9 place-items-center rounded-full text-gray-400 active:bg-gray-100"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Color */}
        <div className="px-5 py-3">
          <p className="text-xs font-medium uppercase tracking-wide text-gray-400">
            Color
          </p>
          <div className="mt-3 flex flex-wrap gap-3">
            <button
              type="button"
              onClick={() => onColor(null)}
              aria-label="No color"
              className={`h-9 w-9 rounded-full border-2 ${
                folder.color ? "border-gray-200" : "border-gray-900"
              } bg-gray-100`}
            />
            {FOLDER_COLORS.map((c) => (
              <button
                key={c}
                type="button"
                onClick={() => onColor(c)}
                aria-label={`Color ${c}`}
                className={`h-9 w-9 rounded-full border-2 ${
                  folder.color === c ? "border-gray-900" : "border-transparent"
                }`}
                style={{ backgroundColor: c }}
              />
            ))}
          </div>
        </div>

        {/* Icon */}
        <div className="px-5 py-3">
          <p className="text-xs font-medium uppercase tracking-wide text-gray-400">
            Icon
          </p>
          <div className="mt-3 grid grid-cols-5 gap-3">
            {FOLDER_ICONS.map((key) => {
              const Icon = resolveFolderIcon(key);
              const active = folder.icon === key;
              return (
                <button
                  key={key}
                  type="button"
                  onClick={() => onIcon(active ? null : key)}
                  aria-label={`Icon ${key}`}
                  className={`grid h-12 place-items-center rounded-xl border ${
                    active
                      ? "border-brand bg-brand/5 text-brand"
                      : "border-gray-200 text-gray-600 active:bg-gray-50"
                  }`}
                >
                  <Icon className="h-5 w-5" />
                </button>
              );
            })}
          </div>
        </div>

        {/* Delete */}
        <div className="px-5 pt-3">
          {confirmDelete ? (
            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={onDelete}
                className="flex-1 rounded-xl bg-red-600 px-4 py-3 text-sm font-semibold text-white active:bg-red-700"
              >
                Delete folder
              </button>
              <button
                type="button"
                onClick={() => setConfirmDelete(false)}
                className="flex-1 rounded-xl border border-gray-200 px-4 py-3 text-sm font-semibold text-gray-700 active:bg-gray-50"
              >
                Keep it
              </button>
            </div>
          ) : (
            <button
              type="button"
              onClick={() => setConfirmDelete(true)}
              className="flex w-full items-center justify-center gap-2 rounded-xl border border-gray-200 px-4 py-3 text-sm font-semibold text-red-600 active:bg-gray-50"
            >
              <Trash2 className="h-4 w-4" />
              Delete folder
            </button>
          )}
          <p className="mt-2 text-center text-xs text-gray-400">
            Deleting archives the folder and its history. It won&apos;t appear
            in your list.
          </p>
        </div>
      </div>
    </div>
  );
}
