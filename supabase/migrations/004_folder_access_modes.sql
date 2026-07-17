-- =====================================================================
-- 004_folder_access_modes.sql
-- Phase 2 — folder permissions management. Depends on 001–003.
--
-- Introduces three per-worker access modes:
--   1. Full   -> workspace_members.all_folders_access = true
--   2. Selected -> all_folders_access = false + folder_members rows
--   3. None   -> all_folders_access = false + no folder_members rows
--
-- Admins are unaffected: role='admin' already grants access to everything via
-- is_folder_admin(). This migration only governs WORKER folder access.
-- Content protection is unchanged — the same RLS policies from 001/003 apply;
-- they simply consult the updated folder_permission() below.
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1. New column: full-access flag on workspace membership.
--    Defaults to false, so new workers start at "No access" (they can see
--    folder metadata per 003, but cannot open folder contents).
-- ---------------------------------------------------------------------
alter table workspace_members
  add column if not exists all_folders_access boolean not null default false;

-- ---------------------------------------------------------------------
-- 2. Extend folder_permission() to honor full access.
--    A worker with all_folders_access = true gets the default worker
--    abilities (view / complete / comment) on EVERY folder in the workspace,
--    including folders created later. It does NOT grant create/edit (those
--    remain explicit per-folder elevations) and never grants folder
--    management (that is admin-only via folders_admin_* policies).
--    create or replace preserves the existing EXECUTE grants.
-- ---------------------------------------------------------------------
create or replace function folder_permission(f_id uuid, perm text) returns boolean as $$
  select case
    when public.is_folder_admin(f_id) then true
    when exists (
      select 1
      from public.folders f
      join public.workspace_members wm on wm.workspace_id = f.workspace_id
      where f.id = f_id
        and wm.user_id = auth.uid()
        and wm.all_folders_access = true
    ) then perm in ('view', 'complete', 'comment')
    else exists (
      select 1 from public.folder_members fm
      where fm.folder_id = f_id and fm.user_id = auth.uid()
      and case perm
        when 'view' then fm.can_view
        when 'create' then fm.can_create_tasks
        when 'edit' then fm.can_edit_tasks
        when 'complete' then fm.can_complete_tasks
        when 'comment' then fm.can_comment
        else false
      end
    )
  end;
$$ language sql security definer stable set search_path = public, pg_temp;

grant execute on function folder_permission(uuid, text) to authenticated;

-- ---------------------------------------------------------------------
-- 3. Admin RPCs to manage access. All are admin-checked and run as
--    SECURITY DEFINER (folder_members/workspace_members writes stay off the
--    client-facing policy surface, per the locked design).
-- ---------------------------------------------------------------------

-- Mode 1: toggle full access to every folder.
-- Enabling full access also clears any per-folder rows so no stale
-- Selected-mode data lingers (Selected -> Full transition).
create or replace function set_all_folders_access(
  p_workspace_id uuid, p_user_id uuid, p_enabled boolean
) returns void as $$
begin
  if not is_workspace_admin(p_workspace_id) then
    raise exception 'Only an administrator may change folder access';
  end if;

  update workspace_members
  set all_folders_access = p_enabled
  where workspace_id = p_workspace_id and user_id = p_user_id;

  if not found then
    raise exception 'User is not a member of this workspace';
  end if;

  if p_enabled then
    delete from folder_members fm
    using folders f
    where fm.folder_id = f.id
      and f.workspace_id = p_workspace_id
      and fm.user_id = p_user_id;
  end if;
end;
$$ language plpgsql security definer set search_path = public, pg_temp;

-- Mode 2: toggle access to a single folder (grant with defaults / revoke).
create or replace function set_folder_access(
  p_folder_id uuid, p_user_id uuid, p_enabled boolean
) returns void as $$
declare
  v_workspace_id uuid;
begin
  select workspace_id into v_workspace_id from folders where id = p_folder_id;
  if v_workspace_id is null then
    raise exception 'Folder not found';
  end if;
  if not is_workspace_admin(v_workspace_id) then
    raise exception 'Only an administrator may change folder access';
  end if;

  if p_enabled then
    -- Grant with default worker abilities. The validate_folder_member_workspace
    -- trigger enforces that the target is a member of this workspace.
    insert into folder_members (folder_id, user_id)
    values (p_folder_id, p_user_id)
    on conflict (folder_id, user_id) do update set can_view = true;
  else
    delete from folder_members
    where folder_id = p_folder_id and user_id = p_user_id;
  end if;
end;
$$ language plpgsql security definer set search_path = public, pg_temp;

-- Mode 3: revoke everything (full flag off + drop all per-folder grants).
create or replace function clear_all_folder_access(
  p_workspace_id uuid, p_user_id uuid
) returns void as $$
begin
  if not is_workspace_admin(p_workspace_id) then
    raise exception 'Only an administrator may change folder access';
  end if;

  update workspace_members
  set all_folders_access = false
  where workspace_id = p_workspace_id and user_id = p_user_id;

  delete from folder_members fm
  using folders f
  where fm.folder_id = f.id
    and f.workspace_id = p_workspace_id
    and fm.user_id = p_user_id;
end;
$$ language plpgsql security definer set search_path = public, pg_temp;

-- ---------------------------------------------------------------------
-- 4. Grants: client-callable by authenticated; internal admin checks gate use.
-- ---------------------------------------------------------------------
revoke execute on function set_all_folders_access(uuid, uuid, boolean) from public;
revoke execute on function set_folder_access(uuid, uuid, boolean) from public;
revoke execute on function clear_all_folder_access(uuid, uuid) from public;

grant execute on function set_all_folders_access(uuid, uuid, boolean) to authenticated;
grant execute on function set_folder_access(uuid, uuid, boolean) to authenticated;
grant execute on function clear_all_folder_access(uuid, uuid) to authenticated;

-- =====================================================================
-- End of migration 004_folder_access_modes.sql
-- =====================================================================
