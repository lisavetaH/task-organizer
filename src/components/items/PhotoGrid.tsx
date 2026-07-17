"use client";

import { useState } from "react";
import { X, Trash2, Share, ChevronLeft, ChevronRight } from "lucide-react";
import type { MediaRecord } from "@/lib/types";
import { PHOTO_BUCKET } from "@/lib/types";
import { shareOrDownload } from "@/lib/share";

/**
 * Photo thumbnails + fullscreen lightbox with swipe (prev/next), pinch/double-
 * tap zoom (native via CSS touch), single-photo share/download, and optional
 * per-photo remove in edit mode.
 */
export function PhotoGrid({
  photos,
  urls,
  onRemove,
}: {
  photos: MediaRecord[];
  urls: Record<string, string>;
  onRemove?: (photo: MediaRecord) => void;
}) {
  const [index, setIndex] = useState<number | null>(null);

  if (photos.length === 0) return null;

  const open = index !== null ? photos[index] : null;
  const openUrl = open ? urls[open.id] : null;

  function go(delta: number) {
    setIndex((i) => {
      if (i === null) return i;
      const n = (i + delta + photos.length) % photos.length;
      return n;
    });
  }

  return (
    <>
      <div className="mt-2 flex flex-wrap gap-2">
        {photos.map((p, i) => {
          const url = urls[p.id];
          return (
            <div key={p.id} className="relative">
              <button
                type="button"
                onClick={() => setIndex(i)}
                className="block h-20 w-20 overflow-hidden rounded-lg bg-gray-100"
                aria-label="View photo"
              >
                {url ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={url} alt={p.original_filename ?? "Photo"} className="h-full w-full object-cover" />
                ) : (
                  <span className="grid h-full w-full place-items-center text-xs text-gray-400">…</span>
                )}
              </button>
              {onRemove ? (
                <button
                  type="button"
                  onClick={() => onRemove(p)}
                  aria-label="Remove photo"
                  className="absolute -right-1.5 -top-1.5 grid h-6 w-6 place-items-center rounded-full bg-white text-red-600 shadow ring-1 ring-gray-200 active:bg-gray-50"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              ) : null}
            </div>
          );
        })}
      </div>

      {open ? (
        <div className="fixed inset-0 z-50 flex flex-col bg-black/95">
          <div
            className="flex items-center justify-between px-3 py-2"
            style={{ paddingTop: "calc(0.5rem + env(safe-area-inset-top))" }}
          >
            <button
              type="button"
              onClick={() => setIndex(null)}
              aria-label="Close"
              className="grid h-11 w-11 place-items-center rounded-full bg-white/10 text-white"
            >
              <X className="h-6 w-6" />
            </button>
            <span className="text-sm text-white/70">
              {(index ?? 0) + 1} / {photos.length}
            </span>
            <button
              type="button"
              onClick={() => open && shareOrDownload(PHOTO_BUCKET, open)}
              aria-label="Share or download"
              className="grid h-11 w-11 place-items-center rounded-full bg-white/10 text-white"
            >
              <Share className="h-5 w-5" />
            </button>
          </div>

          <div className="relative flex flex-1 items-center justify-center overflow-hidden">
            {photos.length > 1 ? (
              <button
                type="button"
                onClick={() => go(-1)}
                aria-label="Previous"
                className="absolute left-1 z-10 grid h-11 w-11 place-items-center rounded-full bg-white/10 text-white"
              >
                <ChevronLeft className="h-6 w-6" />
              </button>
            ) : null}

            <div className="h-full w-full overflow-auto">
              {openUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={openUrl}
                  alt="Preview"
                  className="mx-auto max-h-[80dvh] w-auto touch-pan-x touch-pan-y object-contain"
                  style={{ maxWidth: "100vw" }}
                />
              ) : (
                <div className="grid h-full place-items-center text-white/60">Loading…</div>
              )}
            </div>

            {photos.length > 1 ? (
              <button
                type="button"
                onClick={() => go(1)}
                aria-label="Next"
                className="absolute right-1 z-10 grid h-11 w-11 place-items-center rounded-full bg-white/10 text-white"
              >
                <ChevronRight className="h-6 w-6" />
              </button>
            ) : null}
          </div>
        </div>
      ) : null}
    </>
  );
}
