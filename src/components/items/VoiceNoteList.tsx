"use client";

import { Share, Trash2 } from "lucide-react";
import type { VoiceNote } from "@/lib/types";
import { VOICE_BUCKET } from "@/lib/types";
import { shareOrDownload } from "@/lib/share";

function fmt(sec: number | null): string {
  if (!sec && sec !== 0) return "";
  const m = Math.floor(sec / 60);
  const s = Math.floor(sec % 60);
  return `${m}:${String(s).padStart(2, "0")}`;
}

export function VoiceNoteList({
  notes,
  urls,
  onRemove,
}: {
  notes: VoiceNote[];
  urls: Record<string, string>;
  onRemove?: (n: VoiceNote) => void;
}) {
  if (notes.length === 0) return null;
  return (
    <ul className="mt-2 space-y-2">
      {notes.map((n) => (
        <li key={n.id} className="rounded-lg border border-gray-200 p-2">
          <div className="flex items-center gap-2">
            <div className="min-w-0 flex-1">
              {urls[n.id] ? (
                <audio src={urls[n.id]} controls className="w-full" />
              ) : (
                <p className="px-1 text-sm text-gray-400">Loading audio…</p>
              )}
            </div>
            <button
              type="button"
              onClick={() => shareOrDownload(VOICE_BUCKET, n)}
              aria-label="Share or download"
              className="grid h-9 w-9 shrink-0 place-items-center rounded-lg text-gray-500 active:bg-gray-100"
            >
              <Share className="h-4 w-4" />
            </button>
            {onRemove ? (
              <button
                type="button"
                onClick={() => onRemove(n)}
                aria-label="Delete voice note"
                className="grid h-9 w-9 shrink-0 place-items-center rounded-lg text-red-500 active:bg-red-50"
              >
                <Trash2 className="h-4 w-4" />
              </button>
            ) : null}
          </div>
          {n.duration_seconds != null ? (
            <p className="mt-1 pl-1 text-xs text-gray-400">{fmt(n.duration_seconds)}</p>
          ) : null}
        </li>
      ))}
    </ul>
  );
}
