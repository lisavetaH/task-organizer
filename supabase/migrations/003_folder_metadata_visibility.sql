-- =====================================================================
-- 003_folder_metadata_visibility.sql
-- Phase 2 security-model change (explicitly requested by the product owner).
-- Depends on 001 and 002.
--
-- GOAL: every workspace member can SEE that a folder exists and read its
-- public metadata (name, icon, color, position). NO member can read a
-- folder's contents or member information unless they have folder view
-- access (or are a workspace admin).
--
-- This migration changes exactly ONE table's exposure: `folders`.
-- The content-bearing tables (tasks, task_comments, task_activity) and the
-- access table (folder_members) are deliberately NOT touched here — their
-- strict RLS from 001 is what guarantees contents stay private.
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1. Relax the folders row-visibility policy: metadata is listable by any
--    member of the folder's workspace. The folders row contains only
--    metadata — no tasks, notes, files, or member data live in this table.
-- ---------------------------------------------------------------------
drop policy if exists folders_select on folders;

create policy folders_select on folders for select
using (is_workspace_member(workspace_id));

-- ---------------------------------------------------------------------
-- 2. Column-level protection for the one sensitive column on `folders`.
--    `created_by` is a member id (member information) and must not be
--    readable by clients. We revoke blanket SELECT and re-grant SELECT on
--    only the safe metadata columns to the `authenticated` role.
--
--    SECURITY DEFINER functions (all triggers/RPCs in 001–002) run as the
--    function owner, so they bypass these column grants and keep working.
--    No RLS policy references `created_by`, so nothing breaks.
-- ---------------------------------------------------------------------
revoke select on folders from authenticated;

grant select (
  id,
  workspace_id,
  name,
  color,
  icon,
  position,
  archived_at,
  created_at
) on folders to authenticated;

-- Note: the `anon` (logged-out) role is not granted access here and is
-- blocked at the row level anyway — is_workspace_member() is false when
-- auth.uid() is null, so anon sees zero folder rows.

-- ---------------------------------------------------------------------
-- 3. UNCHANGED (documented here for auditability — no statements needed):
--    * tasks_select          -> still folder_permission(folder_id,'view')
--    * comments_select        -> still requires folder view via parent task
--    * activity_select        -> still requires folder view via parent task
--    * folder_members_select  -> still user_id = auth.uid() OR is_folder_admin
--    * folders_admin_insert / folders_admin_update -> admin-only, unchanged
--    Soft-delete/archive behavior is unchanged (archived_at + list filter).
-- ---------------------------------------------------------------------

-- =====================================================================
-- End of migration 003_folder_metadata_visibility.sql
-- =====================================================================
