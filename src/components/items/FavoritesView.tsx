"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Star } from "lucide-react";
import type { FolderItemFull } from "@/lib/types";
import { PHOTO_BUCKET, VOICE_BUCKET } from "@/lib/types";
import { listFavorites, signUrls, setFavorite } from "@/lib/items";
import { ItemCard } from "./ItemCard";
import { LoadingState } from "@/components/LoadingState";

export function FavoritesView() {
  const [items, setItems] = useState<FolderItemFull[] | null>(null);
  const [photoUrls, setPhotoUrls] = useState<Record<string, string>>({});
  const [voiceUrls, setVoiceUrls] = useState<Record<string, string>>({});
  const [error, setError] = useState<string | null>(null);

  async function load() {
    try {
      const rows = await listFavorites();
      setItems(rows);
      setPhotoUrls(await signUrls(PHOTO_BUCKET, rows.flatMap((r) => r.photos)));
      setVoiceUrls(await signUrls(VOICE_BUCKET, rows.flatMap((r) => r.voice_notes)));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not load favorites.");
      setItems([]);
    }
  }

  useEffect(() => {
    load();
  }, []);

  async function unfavorite(item: FolderItemFull) {
    setItems((prev) => (prev ?? []).filter((i) => i.id !== item.id));
    try {
      await setFavorite(item.id, false);
    } catch {
      load();
    }
  }

  return (
    <main>
      <header className="sticky top-0 z-10 border-b border-gray-200 bg-white/90 px-4 py-4 backdrop-blur">
        <h1 className="text-xl font-bold text-gray-900">Favorites</h1>
      </header>

      {error ? (
        <div className="mx-4 mt-3 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</div>
      ) : null}

      {items === null ? (
        <LoadingState label="Loading favorites…" />
      ) : items.length === 0 ? (
        <section className="px-6 py-20 text-center">
          <span className="mx-auto grid h-14 w-14 place-items-center rounded-full bg-gray-100 text-gray-300">
            <Star className="h-7 w-7" />
          </span>
          <p className="mt-4 text-base font-medium text-gray-900">No favorites yet</p>
          <p className="mx-auto mt-1 max-w-xs text-sm text-gray-500">
            Tap the star on any entry to keep it here.
          </p>
          <Link
            href="/folders"
            className="mt-5 inline-block rounded-xl bg-brand px-4 py-3 text-sm font-semibold text-white active:bg-brand-dark"
          >
            Browse folders
          </Link>
        </section>
      ) : (
        <ul className="pb-24">
          {items.map((item) => (
            <div key={item.id}>
              <Link
                href={`/folders/${item.folder_id}`}
                className="block px-4 pt-2 text-xs font-semibold uppercase tracking-wide text-gray-400"
              >
                Open folder →
              </Link>
              <ItemCard
                item={item}
                photoUrls={photoUrls}
                voiceUrls={voiceUrls}
                canComplete={false}
                canEdit={false}
                onToggleComplete={() => {}}
                onToggleFavorite={() => unfavorite(item)}
                onOpenMenu={() => {}}
              />
            </div>
          ))}
        </ul>
      )}
    </main>
  );
}
