"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { CalendarPlus } from "lucide-react";
import {
  scheduledItemsInRange,
  foldersUserCanComplete,
  type ScheduledItem,
} from "@/lib/schedule";
import { setItemCompleted } from "@/lib/items";
import { todayLocal, ymd, longDate } from "@/lib/dates";
import { ScheduledRow } from "./ScheduledRow";
import { LoadingState } from "@/components/LoadingState";

export function TodayView({ workspaceId }: { workspaceId: string }) {
  const today = useMemo(() => todayLocal(), []);
  const key = ymd(today);
  const [items, setItems] = useState<ScheduledItem[] | null>(null);
  const [completableFolderIds, setCompletableFolderIds] = useState<Set<string>>(
    new Set()
  );
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    scheduledItemsInRange(workspaceId, key, key)
      .then(async (rows) => {
        setItems(rows);
        setCompletableFolderIds(
          await foldersUserCanComplete(rows.map((r) => r.folder_id))
        );
      })
      .catch((e) => {
        setError(e instanceof Error ? e.message : "Could not load.");
        setItems([]);
      });
  }, [workspaceId, key]);

  async function toggleComplete(item: ScheduledItem) {
    const done = !!item.completed_at;
    setItems((prev) =>
      (prev ?? []).map((i) =>
        i.id === item.id
          ? { ...i, completed_at: done ? null : new Date().toISOString() }
          : i
      )
    );
    try {
      await setItemCompleted(item.id, !done);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not update.");
      setItems((prev) =>
        (prev ?? []).map((i) => (i.id === item.id ? item : i))
      );
    }
  }

  const groups = useMemo(() => {
    const m = new Map<string, ScheduledItem[]>();
    for (const it of items ?? []) {
      (m.get(it.folder_id) ?? m.set(it.folder_id, []).get(it.folder_id)!).push(it);
    }
    return Array.from(m.values());
  }, [items]);

  return (
    <main>
      <header className="sticky top-0 z-10 border-b border-gray-200 bg-white/90 px-4 py-4 backdrop-blur">
        <p className="text-xs font-medium uppercase tracking-wide text-brand">
          Today
        </p>
        <h1 className="text-xl font-bold text-gray-900">{longDate(today)}</h1>
      </header>

      {error ? (
        <div className="mx-4 mt-3 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">
          {error}
        </div>
      ) : null}

      {items === null ? (
        <LoadingState label="Loading today…" />
      ) : items.length === 0 ? (
        <section className="px-6 py-20 text-center">
          <p className="text-base font-medium text-gray-900">
            Nothing scheduled today
          </p>
          <p className="mx-auto mt-1 max-w-xs text-sm text-gray-500">
            Add an item with today&apos;s date and it&apos;ll show up here.
          </p>
          <Link
            href="/folders"
            className="mt-5 inline-flex items-center gap-2 rounded-xl bg-brand px-4 py-3 text-sm font-semibold text-white active:bg-brand-dark"
          >
            <CalendarPlus className="h-4 w-4" />
            Go to a folder to add one
          </Link>
        </section>
      ) : (
        <div className="pb-6">
          {groups.map((g) => (
            <section key={g[0].folder_id} className="mt-3">
              <h2 className="px-4 pb-1 text-xs font-semibold uppercase tracking-wide text-gray-400">
                {g[0].folder_name}
              </h2>
              <ul className="divide-y divide-gray-100 border-y border-gray-100">
                {g.map((it) => (
                  <ScheduledRow
                    key={it.id}
                    item={it}
                    onToggleComplete={toggleComplete}
                    canComplete={completableFolderIds.has(it.folder_id)}
                  />
                ))}
              </ul>
            </section>
          ))}
        </div>
      )}
    </main>
  );
}
