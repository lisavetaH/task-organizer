# Changelog

All notable changes to this project are documented in this file.

## 2026-07-19

### Fixed
- Invited users signing up to accept a workspace invitation were left stuck
  at "Email not confirmed" on login, because Supabase's project-wide
  "Confirm email" setting requires clicking a separate confirmation email
  (sent by Supabase's own built-in mailer, unrelated to the app's Resend
  integration) before the account can log in. The invitation token itself
  already establishes the email is legitimate, so this was pure friction.
  - `supabase/migrations/008_auto_confirm_invited_users.sql` — new trigger
    on `auth.users` that auto-confirms a new signup's email only when it
    matches a currently pending, non-expired invitation. The global
    "Confirm email" setting is untouched; direct (non-invited) signups are
    unaffected and still require normal confirmation.

## 2026-07-18

### Added
- Invitations now send real emails via Resend instead of relying on an admin
  manually copying/sharing a link. `sendInviteEmail` returns a real
  success/error result; the Invitations panel shows "Invitation email sent
  successfully." on success or the actual failure reason on error.
  - `src/lib/email.ts`, `src/lib/invitations-actions.ts`,
    `src/components/users/InvitationsPanel.tsx`
- Invitation management: admins can now permanently delete an invitation row
  (not just cancel it) — available for cancelled/expired invitations
  directly, and for pending invitations behind a confirmation prompt.
  - `supabase/migrations/007_invitation_deletion.sql` — new admin-checked
    `delete_invitation` RPC.
  - `src/lib/invitations-actions.ts` — `deleteInvitation()`.
  - `src/components/users/InvitationsPanel.tsx` — Delete button per
    invitation row, list refreshes immediately after deletion.

### Fixed
- Invitation links no longer derive their host from the incoming request
  (`host` / `x-forwarded-host` headers), which caused emails sent while
  running the local dev server to contain `http://localhost:3000/invite/...`
  — useless on another device, and confusing on a machine also running dev.
  `siteOrigin()` now reads `APP_URL` exclusively (set to
  `https://taskorganizer.app` in Vercel Production), falling back to
  `http://localhost:3000` only when unset.
  - `src/lib/invitations-actions.ts`
- Duplicate-invitation error message now explains the fix (use Resend on the
  existing pending invitation, or delete it first) instead of just stating
  the conflict. Verified separately that a *cancelled* invitation never
  blocked re-inviting the same email — the uniqueness constraint is already
  scoped to `status = 'pending'` only.
  - `src/lib/invitations-actions.ts`

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
