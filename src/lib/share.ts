"use client";

import { signDownloadUrl } from "@/lib/items";
import type { MediaRecord } from "@/lib/types";

/**
 * Try the native iOS Share sheet (Web Share API with files). Falls back to a
 * plain download if file-sharing isn't supported. Uses a short-lived signed
 * URL — never a permanent public URL.
 */
export async function shareOrDownload(
  bucket: string,
  media: MediaRecord
): Promise<void> {
  const url = await signDownloadUrl(bucket, media.storage_path, media.original_filename ?? undefined);
  if (!url) throw new Error("Could not prepare the file.");

  const filename = media.original_filename ?? media.storage_path.split("/").pop() ?? "file";

  // Prefer native share with the actual file (lets user "Save to Photos"/Files).
  const nav = navigator as Navigator & {
    canShare?: (data: { files: File[] }) => boolean;
    share?: (data: { files?: File[]; title?: string }) => Promise<void>;
  };
  try {
    if (nav.share && nav.canShare) {
      const resp = await fetch(url);
      const blob = await resp.blob();
      const file = new File([blob], filename, { type: media.mime_type ?? blob.type });
      if (nav.canShare({ files: [file] })) {
        await nav.share({ files: [file], title: filename });
        return;
      }
    }
  } catch {
    // fall through to download
  }

  // Fallback: trigger a download of the original-quality file.
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.rel = "noopener";
  document.body.appendChild(a);
  a.click();
  a.remove();
}

/** Export several files: share as a group if possible, else download each. */
export async function shareOrDownloadMany(
  bucket: string,
  items: MediaRecord[]
): Promise<void> {
  const nav = navigator as Navigator & {
    canShare?: (data: { files: File[] }) => boolean;
    share?: (data: { files?: File[]; title?: string }) => Promise<void>;
  };
  try {
    if (nav.share && nav.canShare) {
      const files: File[] = [];
      for (const m of items) {
        const url = await signDownloadUrl(bucket, m.storage_path, m.original_filename ?? undefined);
        if (!url) continue;
        const resp = await fetch(url);
        const blob = await resp.blob();
        files.push(
          new File([blob], m.original_filename ?? "file", { type: m.mime_type ?? blob.type })
        );
      }
      if (files.length && nav.canShare({ files })) {
        await nav.share({ files, title: "Photos" });
        return;
      }
    }
  } catch {
    // fall through
  }
  for (const m of items) await shareOrDownload(bucket, m);
}
