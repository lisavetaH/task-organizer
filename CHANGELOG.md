# Changelog

All notable changes to this project are documented in this file.

## 2026-07-17

### Added
- Calendar view: each scheduled folder row now has a delete (trash) control on the far right.
  Tapping it prompts "Remove this folder from [date]?" with Cancel/Remove buttons; confirming
  clears that entry's scheduling assignment for the selected date only (`scheduled_date` /
  `scheduled_time` are cleared). The folder, the entry itself, and any photos/attachments/voice
  notes are left completely untouched. The Calendar list updates immediately, with no page
  refresh required.
  - `src/lib/dates.ts` — added `monthDay()` formatter (e.g. "July 19") for the confirm prompt.
  - `src/lib/items.ts` — added `unscheduleItem()`.
  - `src/components/schedule/ScheduledRow.tsx` — added the delete button and confirm dialog.
  - `src/components/schedule/CalendarView.tsx` — wired the new row prop and optimistic removal
    from local state.

### Fixed
- Sign up screen heading changed from "Create account" to "Welcome", so it no longer implies a
  returning user. The Sign in screen is unchanged ("Welcome back").
  - `src/app/(auth)/signup/page.tsx`

### Data
- Removed all pre-launch development/testing data from the database and Storage: 8 folders
  (`ihome`, `5248`, `training`, `shop`, `6656`×2, `New folder`, `New fo`), 4 entries, and 21
  uploaded photos (~30.7 MB in the `folder-photos` bucket) — all created manually while building
  and testing the app, none seeded by any script. The account, its workspace, and workspace
  membership were preserved untouched. No schema, migration, or application code changed. The
  app now opens to zero folders — a clean baseline for a first real user.
