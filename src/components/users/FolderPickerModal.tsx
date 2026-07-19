"use client";

import { useState } from "react";
import { X, Check } from "lucide-react";
import type { Folder } from "@/lib/types";
import { resolveFolderIcon } from "@/lib/folder-icons";

/** Clean modal folder picker for Selected-mode folder access (requirement 8). */
export function FolderPickerModal({
  folders,
  initiallySelected,
  onCancel,
  onSave,
}: {
  folders: Folder[];
  initiallySelected: string[];
  onCancel: () => void;
  onSave: (selectedIds: string[]) => Promise<void>;
}) {
  const [selected, setSelected] = useState<Set<string>>(
    new Set(initiallySelected)
  );
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function toggle(id: string) {
    setSelected((s) => {
      const n = new Set(s);
      if (n.has(id)) n.delete(id);
      else n.add(id);
      return n;
    });
  }

  async function handleSave() {
    setSaving(true);
    setError(null);
    try {
      await onSave(Array.from(selected));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not save folder access.");
      setSaving(false);
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 sm:items-center"
      role="dialog"
      aria-modal="true"
      aria-label="Select folders"
    >
      <div className="w-full max-w-sm rounded-t-2xl bg-white sm:rounded-2xl">
        <div className="flex items-center justify-between border-b border-gray-100 px-4 py-3">
          <h2 className="text-base font-semibold text-gray-900">Select folders</h2>
          <button
            type="button"
            onClick={onCancel}
            disabled={saving}
            aria-label="Close"
            className="grid h-8 w-8 place-items-center rounded-full text-gray-400 active:bg-gray-100 disabled:opacity-60"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <ul className="max-h-96 divide-y divide-gray-100 overflow-y-auto">
          {folders.length === 0 ? (
            <li className="px-4 py-6 text-center text-sm text-gray-400">
              No folders exist yet.
            </li>
          ) : (
            folders.map((f) => {
              const Icon = resolveFolderIcon(f.icon);
              const on = selected.has(f.id);
              return (
                <li key={f.id}>
                  <button
                    type="button"
                    onClick={() => toggle(f.id)}
                    disabled={saving}
                    className="flex w-full items-center gap-3 px-4 py-3 text-left active:bg-gray-50 disabled:opacity-60"
                  >
                    <span
                      className={`grid h-5 w-5 shrink-0 place-items-center rounded border ${
                        on
                          ? "border-brand bg-brand text-white"
                          : "border-gray-300 text-transparent"
                      }`}
                    >
                      <Check className="h-3.5 w-3.5" />
                    </span>
                    <span
                      className="grid h-8 w-8 shrink-0 place-items-center rounded-lg"
                      style={{
                        backgroundColor: f.color ? `${f.color}1a` : "#f3f4f6",
                        color: f.color ?? "#4b5563",
                      }}
                    >
                      <Icon className="h-4 w-4" />
                    </span>
                    <span className="flex-1 truncate text-base text-gray-900">
                      {f.name}
                    </span>
                  </button>
                </li>
              );
            })
          )}
        </ul>

        {error ? (
          <p className="px-4 pt-3 text-sm text-red-600" role="alert">
            {error}
          </p>
        ) : null}

        <div className="flex gap-2 border-t border-gray-100 p-4">
          <button
            type="button"
            onClick={onCancel}
            disabled={saving}
            className="flex-1 rounded-xl border border-gray-200 py-2.5 text-sm font-semibold text-gray-700 active:bg-gray-50 disabled:opacity-60"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleSave}
            disabled={saving}
            className="flex-1 rounded-xl bg-brand py-2.5 text-sm font-semibold text-white active:bg-brand-dark disabled:opacity-60"
          >
            {saving ? "Saving…" : "Save"}
          </button>
        </div>
      </div>
    </div>
  );
}
