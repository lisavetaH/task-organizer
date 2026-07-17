"use client";

import {
  Check, Circle, Calendar, Clock, MoreHorizontal, Pin, Star, Share,
} from "lucide-react";
import type { FolderItemFull } from "@/lib/types";
import { PHOTO_BUCKET } from "@/lib/types";
import { formatTime } from "@/lib/dates";
import { shareOrDownloadMany } from "@/lib/share";
import { PhotoGrid } from "./PhotoGrid";
import { AttachmentList } from "./AttachmentList";
import { VoiceNoteList } from "./VoiceNoteList";

export function ItemCard({
  item,
  photoUrls,
  voiceUrls,
  canComplete,
  canEdit,
  onToggleComplete,
  onToggleFavorite,
  onOpenMenu,
}: {
  item: FolderItemFull;
  photoUrls: Record<string, string>;
  voiceUrls: Record<string, string>;
  canComplete: boolean;
  canEdit: boolean;
  onToggleComplete: () => void;
  onToggleFavorite: () => void;
  onOpenMenu: () => void;
}) {
  const done = !!item.completed_at;
  const dateLabel = item.scheduled_date
    ? new Date(`${item.scheduled_date}T00:00:00`).toLocaleDateString(undefined, { month: "short", day: "numeric" })
    : null;
  const timeLabel = formatTime(item.scheduled_time);

  return (
    <li className="border-b border-gray-100 px-4 py-3">
      <div className="flex gap-3">
        <button
          type="button"
          onClick={onToggleComplete}
          disabled={!canComplete}
          aria-label={done ? "Mark not done" : "Mark done"}
          className={`mt-0.5 grid h-6 w-6 shrink-0 place-items-center rounded-full border ${
            done ? "border-emerald-500 bg-emerald-500 text-white" : "border-gray-300 text-transparent"
          } disabled:opacity-40`}
        >
          {done ? <Check className="h-4 w-4" /> : <Circle className="h-3 w-3" />}
        </button>

        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-1.5">
            {item.is_pinned ? <Pin className="h-3.5 w-3.5 shrink-0 text-amber-500" /> : null}
            {item.title ? (
              <p className={`text-base font-semibold ${done ? "text-gray-400 line-through" : "text-gray-900"}`}>
                {item.title}
              </p>
            ) : null}
          </div>
          {item.body ? (
            <p className={`whitespace-pre-wrap text-sm ${item.title ? "mt-0.5" : ""} ${done ? "text-gray-400" : "text-gray-700"}`}>
              {item.body}
            </p>
          ) : null}

          <PhotoGrid photos={item.photos} urls={photoUrls} />
          <AttachmentList attachments={item.attachments} />
          <VoiceNoteList notes={item.voice_notes} urls={voiceUrls} />

          <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-gray-400">
            {dateLabel ? (
              <span className="flex items-center gap-1"><Calendar className="h-3.5 w-3.5" />{dateLabel}</span>
            ) : null}
            {timeLabel ? (
              <span className="flex items-center gap-1"><Clock className="h-3.5 w-3.5" />{timeLabel}</span>
            ) : null}
            {item.creator_name ? <span>· {item.creator_name}</span> : null}
            {done && item.completer_name ? <span className="text-emerald-600">✓ {item.completer_name}</span> : null}
            {item.photos.length > 1 ? (
              <button
                type="button"
                onClick={() => shareOrDownloadMany(PHOTO_BUCKET, item.photos)}
                className="flex items-center gap-1 text-brand"
              >
                <Share className="h-3.5 w-3.5" />
                Export all
              </button>
            ) : null}
          </div>
        </div>

        <div className="flex shrink-0 flex-col items-center gap-1">
          <button
            type="button"
            onClick={onToggleFavorite}
            aria-label={item.is_favorite ? "Remove favorite" : "Add favorite"}
            className="grid h-8 w-8 place-items-center rounded-lg active:bg-gray-100"
          >
            <Star className={`h-5 w-5 ${item.is_favorite ? "fill-amber-400 text-amber-400" : "text-gray-300"}`} />
          </button>
          {canEdit ? (
            <button
              type="button"
              onClick={onOpenMenu}
              aria-label="Item options"
              className="grid h-8 w-8 place-items-center rounded-lg text-gray-400 active:bg-gray-100"
            >
              <MoreHorizontal className="h-5 w-5" />
            </button>
          ) : null}
        </div>
      </div>
    </li>
  );
}
