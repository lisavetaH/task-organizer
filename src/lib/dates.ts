// Local-timezone date helpers. All weekday/month names come from Intl, never
// hardcoded. "YYYY-MM-DD" strings match the DB `date` columns (no TZ shift).

export function ymd(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

export function todayLocal(): Date {
  const n = new Date();
  return new Date(n.getFullYear(), n.getMonth(), n.getDate());
}

export function addDays(d: Date, n: number): Date {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate() + n);
}

/** Sunday-based start of the week containing `d`. */
export function startOfWeek(d: Date): Date {
  return addDays(d, -d.getDay());
}

export function startOfMonth(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), 1);
}

export function addMonths(d: Date, n: number): Date {
  return new Date(d.getFullYear(), d.getMonth() + n, 1);
}

export function longDate(d: Date): string {
  return d.toLocaleDateString(undefined, {
    weekday: "long",
    month: "long",
    day: "numeric",
  });
}

export function weekdayLong(d: Date): string {
  return d.toLocaleDateString(undefined, { weekday: "long" });
}

export function weekdayShort(d: Date): string {
  return d.toLocaleDateString(undefined, { weekday: "short" });
}

export function monthYear(d: Date): string {
  return d.toLocaleDateString(undefined, { month: "long", year: "numeric" });
}

export function dayNum(d: Date): number {
  return d.getDate();
}

/** Short weekday headers (S M T W T F S) localized, Sunday first. */
export function weekdayInitials(): string[] {
  const base = new Date(2023, 0, 1); // a Sunday
  return Array.from({ length: 7 }, (_, i) =>
    addDays(base, i).toLocaleDateString(undefined, { weekday: "narrow" })
  );
}

export function formatTime(t: string | null): string | null {
  if (!t) return null;
  const [h, m] = t.split(":");
  const d = new Date();
  d.setHours(Number(h), Number(m), 0, 0);
  return d.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" });
}

export function isSameDay(a: Date, b: Date): boolean {
  return ymd(a) === ymd(b);
}
