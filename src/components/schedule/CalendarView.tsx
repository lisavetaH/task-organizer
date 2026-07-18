"use client";

import { useEffect, useMemo, useState } from "react";
import { ChevronLeft, ChevronRight, Plus, X } from "lucide-react";
import { scheduledItemsInRange, type ScheduledItem } from "@/lib/schedule";
import { foldersUserCanCreateIn } from "@/lib/folders";
import { unscheduleItem } from "@/lib/items";
import { ItemEditor } from "@/components/items/ItemEditor";
import { ScheduledRow } from "./ScheduledRow";
import { LoadingState } from "@/components/LoadingState";
import {
  todayLocal,
  startOfMonth,
  addMonths,
  addDays,
  startOfWeek,
  ymd,
  monthYear,
  monthDay,
  weekdayInitials,
  isSameDay,
  longDate,
} from "@/lib/dates";

export function CalendarView({ workspaceId }: { workspaceId: string }) {
  const today = useMemo(() => todayLocal(), []);
  const [month, setMonth] = useState(() => startOfMonth(todayLocal()));
  const [selected, setSelected] = useState<Date>(() => todayLocal());
  const [items, setItems] = useState<ScheduledItem[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [reloadKey, setReloadKey] = useState(0);

  // create flow
  const [choosingFolder, setChoosingFolder] = useState(false);
  const [folders, setFolders] = useState<{ id: string; name: string }[] | null>(null);
  const [creatingIn, setCreatingIn] = useState<string | null>(null);

  const weekdays = useMemo(() => weekdayInitials(), []);
  const gridStart = useMemo(() => startOfWeek(month), [month]);
  const gridDays = useMemo(
    () => Array.from({ length: 42 }, (_, i) => addDays(gridStart, i)),
    [gridStart]
  );

  useEffect(() => {
    setItems(null);
    scheduledItemsInRange(workspaceId, ymd(gridDays[0]), ymd(gridDays[41]))
      .then(setItems)
      .catch((e) => {
        setError(e instanceof Error ? e.message : "Could not load.");
        setItems([]);
      });
  }, [workspaceId, gridDays, reloadKey]);

  const countByDay = useMemo(() => {
    const m = new Map<string, number>();
    for (const it of items ?? []) {
      m.set(it.scheduled_date!, (m.get(it.scheduled_date!) ?? 0) + 1);
    }
    return m;
  }, [items]);

  const selectedItems = useMemo(
    () => (items ?? []).filter((it) => it.scheduled_date === ymd(selected)),
    [items, selected]
  );

  async function handleUnschedule(itemId: string) {
    setItems((prev) => (prev ?? []).filter((it) => it.id !== itemId));
    try {
      await unscheduleItem(itemId);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not remove.");
      setReloadKey((k) => k + 1); // restore accurate state
    }
  }

  async function openCreate() {
    setError(null);
    setChoosingFolder(true);
    if (folders === null) {
      try {
        setFolders(await foldersUserCanCreateIn(workspaceId));
      } catch {
        setFolders([]);
      }
    }
  }

  return (
    <main>
      <header className="sticky top-0 z-10 flex items-center justify-between border-b border-gray-200 bg-white/90 px-2 py-3 backdrop-blur">
        <button
          type="button"
          onClick={() => setMonth((m) => addMonths(m, -1))}
          aria-label="Previous month"
          className="grid h-10 w-10 place-items-center rounded-full text-gray-500 active:bg-gray-100"
        >
          <ChevronLeft className="h-6 w-6" />
        </button>
        <h1 className="text-base font-semibold text-gray-900">{monthYear(month)}</h1>
        <button
          type="button"
          onClick={() => setMonth((m) => addMonths(m, 1))}
          aria-label="Next month"
          className="grid h-10 w-10 place-items-center rounded-full text-gray-500 active:bg-gray-100"
        >
          <ChevronRight className="h-6 w-6" />
        </button>
      </header>

      {error ? (
        <div className="mx-4 mt-3 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</div>
      ) : null}

      {/* Weekday header */}
      <div className="grid grid-cols-7 px-2 pt-2 text-center text-xs font-medium text-gray-400">
        {weekdays.map((w, i) => (
          <div key={i} className="py-1">
            {w}
          </div>
        ))}
      </div>

      {/* Month grid */}
      <div className="grid grid-cols-7 gap-px px-2 pb-2">
        {gridDays.map((d) => {
          const inMonth = d.getMonth() === month.getMonth();
          const isToday = isSameDay(d, today);
          const isSelected = isSameDay(d, selected);
          const count = countByDay.get(ymd(d)) ?? 0;
          return (
            <button
              key={ymd(d)}
              type="button"
              onClick={() => setSelected(new Date(d))}
              className="flex flex-col items-center py-1.5"
            >
              <span
                className={`grid h-9 w-9 place-items-center rounded-full text-sm ${
                  isSelected
                    ? "bg-brand text-white"
                    : isToday
                    ? "font-bold text-brand"
                    : inMonth
                    ? "text-gray-900"
                    : "text-gray-300"
                }`}
              >
                {d.getDate()}
              </span>
              <span
                className={`mt-0.5 h-1.5 w-1.5 rounded-full ${
                  count > 0 && !isSelected ? "bg-brand" : "bg-transparent"
                }`}
              />
            </button>
          );
        })}
      </div>

      {/* Selected day */}
      <div className="border-t border-gray-100">
        <div className="flex items-center justify-between px-4 pb-1 pt-3">
          <h2 className="text-sm font-semibold text-gray-900">{longDate(selected)}</h2>
          <button
            type="button"
            onClick={openCreate}
            aria-label="New entry for this date"
            className="grid h-9 w-9 place-items-center rounded-full bg-brand text-white active:bg-brand-dark"
          >
            <Plus className="h-5 w-5" />
          </button>
        </div>

        {items === null ? (
          <LoadingState label="Loading…" />
        ) : selectedItems.length === 0 ? (
          <p className="px-4 pb-6 pt-2 text-sm text-gray-400">
            No entries scheduled for this day. Tap + to add one.
          </p>
        ) : (
          <ul className="divide-y divide-gray-100 pb-24">
            {selectedItems.map((it) => (
              <ScheduledRow
                key={it.id}
                item={it}
                dateLabel={monthDay(selected)}
                onRemove={handleUnschedule}
              />
            ))}
          </ul>
        )}
      </div>

      {/* Folder picker for the + create flow */}
      {choosingFolder ? (
        <div className="fixed inset-0 z-40 flex flex-col justify-end">
          <button
            type="button"
            aria-label="Close"
            onClick={() => setChoosingFolder(false)}
            className="absolute inset-0 bg-black/40"
          />
          <div
            className="relative z-10 max-h-[70dvh] overflow-y-auto rounded-t-2xl bg-white"
            style={{ paddingBottom: "calc(1rem + env(safe-area-inset-bottom))" }}
          >
            <div className="flex items-center justify-between border-b border-gray-100 px-4 py-3">
              <h3 className="text-base font-semibold text-gray-900">
                Add entry on {longDate(selected)}
              </h3>
              <button
                type="button"
                onClick={() => setChoosingFolder(false)}
                aria-label="Close"
                className="grid h-9 w-9 place-items-center rounded-full text-gray-400 active:bg-gray-100"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            <p className="px-4 pt-3 text-xs font-medium uppercase tracking-wide text-gray-400">
              Choose a folder
            </p>
            {folders === null ? (
              <LoadingState label="Loading folders…" />
            ) : folders.length === 0 ? (
              <p className="px-4 py-6 text-sm text-gray-400">
                You don&apos;t have permission to add entries to any folder yet.
              </p>
            ) : (
              <ul className="py-1">
                {folders.map((f) => (
                  <li key={f.id}>
                    <button
                      type="button"
                      onClick={() => {
                        setChoosingFolder(false);
                        setCreatingIn(f.id);
                      }}
                      className="w-full px-4 py-3.5 text-left text-base font-medium text-gray-900 active:bg-gray-50"
                    >
                      {f.name}
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      ) : null}

      {/* Editor prefilled with the selected date */}
      {creatingIn ? (
        <ItemEditor
          folderId={creatingIn}
          photoUrls={{}}
          voiceUrls={{}}
          defaultDate={ymd(selected)}
          onClose={() => setCreatingIn(null)}
          onSaved={() => {
            setCreatingIn(null);
            setReloadKey((k) => k + 1); // refresh calendar so the new entry shows
          }}
        />
      ) : null}
    </main>
  );
}
