"use client";

import { useState } from "react";
import Link from "next/link";
import { Check, Circle, Trash2 } from "lucide-react";
import type { ScheduledItem } from "@/lib/schedule";
import { formatTime } from "@/lib/dates";
import { resolveFolderIcon } from "@/lib/folder-icons";

export function ScheduledRow({
  item,
  dateLabel,
  onRemove,
  onToggleComplete,
  canComplete,
}: {
  item: ScheduledItem;
  /** e.g. "July 19" — the currently selected calendar day, for the confirm prompt. */
  dateLabel?: string;
  /** Omit to render without a delete affordance (e.g. Today/Week views). */
  onRemove?: (itemId: string) => void;
  /** Omit to render a static (non-interactive) completion indicator. */
  onToggleComplete?: (item: ScheduledItem) => void;
  canComplete?: boolean;
}) {
  const Icon = resolveFolderIcon(item.folder_icon);
  const done = !!item.completed_at;
  const time = formatTime(item.scheduled_time);
  const label = item.title || item.body || "Untitled";
  const [confirming, setConfirming] = useState(false);

  return (
    <li className="flex items-center">
      {onToggleComplete ? (
        <button
          type="button"
          onClick={() => onToggleComplete(item)}
          disabled={!canComplete}
          aria-label={done ? "Mark not done" : "Mark done"}
          className={`ml-3 grid h-6 w-6 shrink-0 place-items-center rounded-full border ${
            done
              ? "border-emerald-500 bg-emerald-500 text-white"
              : "border-gray-300 text-transparent"
          } disabled:opacity-40`}
        >
          {done ? <Check className="h-4 w-4" /> : <Circle className="h-3 w-3" />}
        </button>
      ) : null}

      <Link
        href={`/folders/${item.folder_id}`}
        className="flex min-w-0 flex-1 items-center gap-3 px-4 py-3 active:bg-gray-50"
      >
        <span
          className="grid h-8 w-8 shrink-0 place-items-center rounded-lg"
          style={{
            backgroundColor: item.folder_color ? `${item.folder_color}1a` : "#f3f4f6",
            color: item.folder_color ?? "#4b5563",
          }}
        >
          <Icon className="h-4 w-4" />
        </span>
        <div className="min-w-0 flex-1">
          <p
            className={`truncate text-sm ${
              done ? "text-gray-400 line-through" : "font-medium text-gray-900"
            }`}
          >
            {label}
          </p>
          <p className="truncate text-xs text-gray-400">{item.folder_name}</p>
        </div>
        {time ? (
          <span className="shrink-0 text-xs font-medium text-gray-500">{time}</span>
        ) : null}
        {!onToggleComplete && done ? (
          <Check className="h-4 w-4 shrink-0 text-emerald-500" />
        ) : null}
      </Link>

      {onRemove ? (
        <button
          type="button"
          onClick={() => setConfirming(true)}
          aria-label={`Remove ${item.folder_name} from ${dateLabel}`}
          className="mr-2 grid h-9 w-9 shrink-0 place-items-center rounded-full text-gray-300 active:bg-red-50 active:text-red-600"
        >
          <Trash2 className="h-4 w-4" />
        </button>
      ) : null}

      {confirming ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center px-6">
          <button
            type="button"
            aria-label="Cancel"
            onClick={() => setConfirming(false)}
            className="absolute inset-0 bg-black/40"
          />
          <div className="relative z-10 w-full max-w-xs rounded-2xl bg-white p-5 text-center shadow-xl">
            <p className="text-sm font-medium text-gray-900">
              Remove this folder from {dateLabel}?
            </p>
            <div className="mt-4 flex gap-2">
              <button
                type="button"
                onClick={() => setConfirming(false)}
                className="flex-1 rounded-xl border border-gray-200 px-4 py-2.5 text-sm font-semibold text-gray-700 active:bg-gray-50"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => {
                  setConfirming(false);
                  onRemove?.(item.id);
                }}
                className="flex-1 rounded-xl bg-red-600 px-4 py-2.5 text-sm font-semibold text-white active:bg-red-700"
              >
                Remove
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </li>
  );
}
