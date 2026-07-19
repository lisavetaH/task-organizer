"use client";

import { useEffect, useMemo, useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import {
  scheduledItemsInRange,
  foldersUserCanComplete,
  type ScheduledItem,
} from "@/lib/schedule";
import { setItemCompleted } from "@/lib/items";
import {
  todayLocal,
  startOfWeek,
  addDays,
  ymd,
  weekdayLong,
  dayNum,
  isSameDay,
  monthYear,
} from "@/lib/dates";
import { ScheduledRow } from "./ScheduledRow";
import { LoadingState } from "@/components/LoadingState";

export function WeekView({ workspaceId }: { workspaceId: string }) {
  const today = useMemo(() => todayLocal(), []);
  const [weekStart, setWeekStart] = useState(() => startOfWeek(todayLocal()));
  const [items, setItems] = useState<ScheduledItem[] | null>(null);
  const [completableFolderIds, setCompletableFolderIds] = useState<Set<string>>(
    new Set()
  );
  const [error, setError] = useState<string | null>(null);

  const days = useMemo(
    () => Array.from({ length: 7 }, (_, i) => addDays(weekStart, i)),
    [weekStart]
  );

  useEffect(() => {
    setItems(null);
    scheduledItemsInRange(workspaceId, ymd(days[0]), ymd(days[6]))
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
  }, [workspaceId, days]);

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

  const byDay = useMemo(() => {
    const m = new Map<string, ScheduledItem[]>();
    for (const it of items ?? []) {
      const k = it.scheduled_date!;
      (m.get(k) ?? m.set(k, []).get(k)!).push(it);
    }
    return m;
  }, [items]);

  return (
    <main>
      <header className="sticky top-0 z-10 flex items-center justify-between border-b border-gray-200 bg-white/90 px-2 py-3 backdrop-blur">
        <button
          type="button"
          onClick={() => setWeekStart((w) => addDays(w, -7))}
          aria-label="Previous week"
          className="grid h-10 w-10 place-items-center rounded-full text-gray-500 active:bg-gray-100"
        >
          <ChevronLeft className="h-6 w-6" />
        </button>
        <h1 className="text-base font-semibold text-gray-900">
          {monthYear(weekStart)}
        </h1>
        <button
          type="button"
          onClick={() => setWeekStart((w) => addDays(w, 7))}
          aria-label="Next week"
          className="grid h-10 w-10 place-items-center rounded-full text-gray-500 active:bg-gray-100"
        >
          <ChevronRight className="h-6 w-6" />
        </button>
      </header>

      {error ? (
        <div className="mx-4 mt-3 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">
          {error}
        </div>
      ) : null}

      {items === null ? (
        <LoadingState label="Loading week…" />
      ) : (
        <div className="pb-6">
          {days.map((d) => {
            const dayItems = byDay.get(ymd(d)) ?? [];
            const isToday = isSameDay(d, today);
            return (
              <section key={ymd(d)} className="border-b border-gray-100">
                <div
                  className={`flex items-baseline gap-2 px-4 py-2 ${
                    isToday ? "bg-brand/5" : ""
                  }`}
                >
                  <span
                    className={`text-sm font-semibold ${
                      isToday ? "text-brand" : "text-gray-900"
                    }`}
                  >
                    {weekdayLong(d)}
                  </span>
                  <span className="text-sm text-gray-400">{dayNum(d)}</span>
                  {isToday ? (
                    <span className="ml-auto text-xs font-medium text-brand">
                      Today
                    </span>
                  ) : null}
                </div>
                {dayItems.length > 0 ? (
                  <ul className="divide-y divide-gray-100">
                    {dayItems.map((it) => (
                      <ScheduledRow
                        key={it.id}
                        item={it}
                        onToggleComplete={toggleComplete}
                        canComplete={completableFolderIds.has(it.folder_id)}
                      />
                    ))}
                  </ul>
                ) : (
                  <p className="px-4 pb-3 text-xs text-gray-300">No items</p>
                )}
              </section>
            );
          })}
        </div>
      )}
    </main>
  );
}
