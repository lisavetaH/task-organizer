"use client";

import Link from "next/link";
import { Check } from "lucide-react";
import type { ScheduledItem } from "@/lib/schedule";
import { formatTime } from "@/lib/dates";
import { resolveFolderIcon } from "@/lib/folder-icons";

export function ScheduledRow({ item }: { item: ScheduledItem }) {
  const Icon = resolveFolderIcon(item.folder_icon);
  const done = !!item.completed_at;
  const time = formatTime(item.scheduled_time);
  const label = item.title || item.body || "Untitled";

  return (
    <Link
      href={`/folders/${item.folder_id}`}
      className="flex items-center gap-3 px-4 py-3 active:bg-gray-50"
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
      {done ? <Check className="h-4 w-4 shrink-0 text-emerald-500" /> : null}
    </Link>
  );
}
