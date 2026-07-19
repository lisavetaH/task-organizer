# Changelog

All notable changes to this project are documented in this file.

## 2026-07-19

### Added
- Replaced the flat 2-tier role model (admin/worker) with a 3-tier model —
  **Owner / Administrator / Member** — cleanly separated from folder access
  (**Full / Selected**, "None" removed — it had no real business value and
  Selected mode is now fully functional). Owner is unique per workspace and
  protected: cannot be removed or demoted, and only the Owner can
  promote/demote Administrators or transfer ownership. Administrators manage
  folders, tasks, invitations, and plain members, but cannot touch the Owner.
  - `supabase/migrations/009_role_model_and_permissions.sql` — role check
    constraints, data migration for existing rows, `is_workspace_owner()`,
    rewritten `change_member_role`/`remove_workspace_member`, new
    `transfer_ownership` RPC, and a reverted `folders_select` policy so
    Selected-mode members no longer see folders they aren't assigned to at
    all (previously, migration 003 made folder names visible to every
    member regardless of access — deliberately reversed per this milestone).
  - New "Selected" folder-access flow: choosing it opens a modal folder
    picker (`FolderPickerModal.tsx`) with a checkbox per folder instead of
    the old inline list; saves immediately.
  - New role-management controls on Users & Access (Owner-only): promote/
    demote between Administrator and Member, and a confirmed "Make owner"
    ownership transfer. Remove-member respects the same hierarchy
    server-side, not just via hidden buttons.
- Task completion checkboxes now work from **Today** and **Week**, not just
  inside a folder — `ScheduledRow.tsx` gained the same interactive checkbox
  `ItemCard.tsx` already had; a new `foldersUserCanComplete()` helper
  (`src/lib/schedule.ts`) resolves per-folder completion permission across
  the multiple folders a schedule view can span.
- Existing accounts with the placeholder display name "New User" (see the
  `handle_new_user` fallback in migration 001) are now prompted once, right
  after login, to set a real name — `SetDisplayNamePrompt.tsx`, using the
  profile table's existing self-update RLS policy (no RLS change needed).
  The "(you)" indicator next to your own name in Users & Access is now a
  small, separately styled "(You)" badge instead of being blended into the
  name text.

### Fixed
- A folder member with only "complete" permission (no "edit") could rewrite
  any field on a task — title, body, schedule, pin state — not just tick the
  completion box, because the `folder_items` update RLS policy only checked
  whether *some* editable permission existed on the row, not which columns
  were actually changing. Found live during this milestone's production
  verification pass (a throwaway Selected-access test account, granted only
  `can_complete_tasks`, successfully overwrote a task's title via a direct
  API call) and fixed the same day, not left for a follow-up.
  - `supabase/migrations/010_enforce_task_edit_permission.sql` — extends the
    existing `protect_item_update()` trigger (already responsible for
    deriving `completed_by` server-side) to also reject any change to a
    non-completion column unless the caller has `edit` folder permission.
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
