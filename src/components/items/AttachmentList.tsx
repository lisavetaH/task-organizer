"use client";

import { FileText, Share, Trash2 } from "lucide-react";
import type { MediaRecord } from "@/lib/types";
import { ATTACHMENT_BUCKET } from "@/lib/types";
import { shareOrDownload } from "@/lib/share";

function prettySize(bytes: number | null): string {
  if (!bytes) return "";
  const kb = bytes / 1024;
  if (kb < 1024) return `${Math.round(kb)} KB`;
  return `${(kb / 1024).toFixed(1)} MB`;
}

function typeLabel(mime: string | null, name: string | null): string {
  if (name?.includes(".")) return name.split(".").pop()!.toUpperCase();
  if (mime) return mime.split("/").pop()!.toUpperCase();
  return "FILE";
}

export function AttachmentList({
  attachments,
  onRemove,
}: {
  attachments: MediaRecord[];
  onRemove?: (a: MediaRecord) => void;
}) {
  if (attachments.length === 0) return null;
  return (
    <ul className="mt-2 space-y-1.5">
      {attachments.map((a) => (
        <li
          key={a.id}
          className="flex items-center gap-2 rounded-lg border border-gray-200 px-3 py-2"
        >
          <span className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-gray-100 text-gray-500">
            <FileText className="h-4 w-4" />
          </span>
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-medium text-gray-900">
              {a.original_filename ?? "File"}
            </p>
            <p className="text-xs text-gray-400">
              {typeLabel(a.mime_type, a.original_filename)}
              {a.size_bytes ? ` · ${prettySize(a.size_bytes)}` : ""}
            </p>
          </div>
          <button
            type="button"
            onClick={() => shareOrDownload(ATTACHMENT_BUCKET, a)}
            aria-label="Open, share or download"
            className="grid h-9 w-9 shrink-0 place-items-center rounded-lg text-gray-500 active:bg-gray-100"
          >
            <Share className="h-4 w-4" />
          </button>
          {onRemove ? (
            <button
              type="button"
              onClick={() => onRemove(a)}
              aria-label="Remove file"
              className="grid h-9 w-9 shrink-0 place-items-center rounded-lg text-red-500 active:bg-red-50"
            >
              <Trash2 className="h-4 w-4" />
            </button>
          ) : null}
        </li>
      ))}
    </ul>
  );
}
