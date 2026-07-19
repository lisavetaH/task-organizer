-- =====================================================================
-- 009_role_model_and_permissions.sql
-- Depends on 001-008. Nothing in 001-008 is modified.
--
-- Replaces the flat 2-tier role model ('admin' | 'worker') with a 3-tier
-- model ('owner' | 'admin' | 'member'), cleanly separated from folder
-- access (unchanged concept: Full via all_folders_access, or Selected via
-- folder_members rows — the UI-level "None" option is removed, but that
-- was never a distinct DB state; it was just Selected with zero rows).
--
-- Key design choice: is_workspace_admin() is redefined to mean
-- "role in ('owner','admin')" rather than being replaced. Every existing
-- RLS policy and function in 001-008 (tasks, folder_items, comments,
-- storage policies, etc.) already calls is_workspace_admin()/
-- is_folder_admin()/folder_permission() — none of them need to change.
-- A new is_workspace_owner() covers the handful of owner-exclusive ops.
--
-- Also reverts 003_folder_metadata_visibility.sql's folders_select policy:
-- folder existence/metadata is no longer visible to every workspace
-- member, only to those with folder_permission(id,'view') — explicitly
-- requested so Selected-mode members only see folders they're assigned
-- to, not just their contents. The column-level grant restriction from
-- 003 (hiding created_by) is untouched.
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1. Drop the 2-tier constraints FIRST -- the data migration below
--    introduces 'owner', which the old ('admin','worker') constraint
--    would reject.
-- ---------------------------------------------------------------------
alter table workspace_members drop constraint workspace_members_role_check;
alter table invitations drop constraint invitations_role_check;

-- ---------------------------------------------------------------------
-- 2. Data migration.
-- ---------------------------------------------------------------------
update workspace_members wm
set role = 'owner'
from workspaces w
where w.id = wm.workspace_id
  and wm.user_id = w.created_by
  and wm.role = 'admin';

update workspace_members set role = 'member' where role = 'worker';
update invitations set role = 'member' where role = 'worker';

-- ---------------------------------------------------------------------
-- 3. Add the new 3-tier constraints.
-- ---------------------------------------------------------------------
alter table workspace_members add constraint workspace_members_role_check
  check (role in ('owner', 'admin', 'member'));

alter table invitations add constraint invitations_role_check
  check (role in ('admin', 'member'));

-- ---------------------------------------------------------------------
-- 4. Helper functions.
-- ---------------------------------------------------------------------
create or replace function is_workspace_admin(ws_id uuid) returns boolean as $$
  select exists (
    select 1 from public.workspace_members
    where workspace_id = ws_id and user_id = auth.uid() and role in ('owner', 'admin')
  );
$$ language sql security definer stable set search_path = public, pg_temp;

create or replace function is_workspace_owner(ws_id uuid) returns boolean as $$
  select exists (
    select 1 from public.workspace_members
    where workspace_id = ws_id and user_id = auth.uid() and role = 'owner'
  );
$$ language sql security definer stable set search_path = public, pg_temp;

revoke execute on function is_workspace_owner(uuid) from public;
revoke execute on function is_workspace_owner(uuid) from anon;
grant execute on function is_workspace_owner(uuid) to authenticated;

-- ---------------------------------------------------------------------
-- 4. Folder visibility: revert 003's blanket member visibility.
--
-- IMPORTANT: this must keep the direct is_workspace_admin(workspace_id)
-- branch (checked against the row's own column, no self-lookup), not rely
-- on folder_permission(id,'view') alone. folder_permission() internally
-- calls is_folder_admin(f_id), which re-queries the folders table BY ID —
-- a self-referential lookup into the very table this policy governs. On
-- INSERT ... RETURNING (e.g. creating a folder), that self-lookup does not
-- see the row just inserted in the same statement, so admins/owner would
-- get "new row violates row-level security policy" immediately after a
-- successful insert. Checking is_workspace_admin(workspace_id) directly
-- avoids the self-lookup entirely for the admin/owner case. Members only
-- ever reach the folder_permission(id,'view') branch for folders that
-- already exist (they cannot insert folders at all), so that branch never
-- hits this same-statement visibility issue in practice.
-- ---------------------------------------------------------------------
drop policy if exists folders_select on folders;
create policy folders_select on folders for select
using (is_workspace_admin(workspace_id) or folder_permission(id, 'view'));

-- ---------------------------------------------------------------------
-- 5. create_workspace: creator becomes 'owner', not 'admin'.
-- ---------------------------------------------------------------------
create or replace function create_workspace(
  p_name text
) returns workspaces as $$
declare
  v_workspace workspaces;
begin
  if auth.uid() is null then
    raise exception 'Authentication required';
  end if;

  insert into workspaces (name, created_by)
  values (p_name, auth.uid())
  returning * into v_workspace;

  insert into workspace_members (workspace_id, user_id, role)
  values (v_workspace.id, auth.uid(), 'owner');

  return v_workspace;
end;
$$ language plpgsql security definer set search_path = public, pg_temp;

-- ---------------------------------------------------------------------
-- 6. add_workspace_member: never creates a second owner via this path.
-- ---------------------------------------------------------------------
create or replace function add_workspace_member(
  p_workspace_id uuid, p_user_id uuid, p_role text
) returns workspace_members as $$
declare v_member workspace_members;
begin
  if not is_workspace_admin(p_workspace_id) then
    raise exception 'Only an administrator may add members';
  end if;
  if p_role not in ('admin', 'member') then
    raise exception 'Invalid role';
  end if;

  insert into workspace_members (workspace_id, user_id, role)
  values (p_workspace_id, p_user_id, p_role)
  on conflict (workspace_id, user_id) do update set role = excluded.role
  returning * into v_member;

  return v_member;
end;
$$ language plpgsql security definer set search_path = public, pg_temp;

-- ---------------------------------------------------------------------
-- 7. change_member_role: owner-only, promote/demote between admin/member.
--    Cannot target the owner (ownership only moves via transfer_ownership
--    below). The old "last admin" guard is gone -- owner uniqueness is
--    now the real invariant, enforced by never allowing this function to
--    set or target role = 'owner'.
-- ---------------------------------------------------------------------
create or replace function change_member_role(
  p_workspace_id uuid, p_user_id uuid, p_new_role text
) returns workspace_members as $$
declare
  v_current_role text;
  v_member workspace_members;
begin
  if not is_workspace_owner(p_workspace_id) then
    raise exception 'Only the owner may change member roles';
  end if;
  if p_new_role not in ('admin', 'member') then
    raise exception 'Invalid role';
  end if;

  select role into v_current_role from workspace_members
  where workspace_id = p_workspace_id and user_id = p_user_id
  for update;

  if v_current_role is null then
    raise exception 'User is not a member of this workspace';
  end if;
  if v_current_role = 'owner' then
    raise exception 'Use transfer_ownership to change the owner''s role';
  end if;

  update workspace_members set role = p_new_role
  where workspace_id = p_workspace_id and user_id = p_user_id
  returning * into v_member;

  return v_member;
end;
$$ language plpgsql security definer set search_path = public, pg_temp;

-- ---------------------------------------------------------------------
-- 8. remove_workspace_member: owner is never removable. Admins may only
--    be removed by the owner. Members may be removed by owner or admin.
-- ---------------------------------------------------------------------
create or replace function remove_workspace_member(
  p_workspace_id uuid, p_user_id uuid
) returns void as $$
declare
  v_role text;
begin
  select role into v_role from workspace_members
  where workspace_id = p_workspace_id and user_id = p_user_id
  for update;

  if v_role is null then
    raise exception 'User is not a member of this workspace';
  end if;

  if v_role = 'owner' then
    raise exception 'The workspace owner cannot be removed';
  end if;

  if v_role = 'admin' then
    if not is_workspace_owner(p_workspace_id) then
      raise exception 'Only the owner may remove an administrator';
    end if;
  else
    if not is_workspace_admin(p_workspace_id) then
      raise exception 'Only an administrator may remove members';
    end if;
  end if;

  delete from workspace_members
  where workspace_id = p_workspace_id and user_id = p_user_id;
end;
$$ language plpgsql security definer set search_path = public, pg_temp;

-- ---------------------------------------------------------------------
-- 9. transfer_ownership: owner-only, atomic handoff. Exactly one owner
--    per workspace at all times.
-- ---------------------------------------------------------------------
create or replace function transfer_ownership(
  p_workspace_id uuid, p_new_owner_user_id uuid
) returns void as $$
declare
  v_target_role text;
begin
  if not is_workspace_owner(p_workspace_id) then
    raise exception 'Only the current owner may transfer ownership';
  end if;
  if p_new_owner_user_id = auth.uid() then
    raise exception 'You are already the owner';
  end if;

  select role into v_target_role from workspace_members
  where workspace_id = p_workspace_id and user_id = p_new_owner_user_id
  for update;

  if v_target_role is null then
    raise exception 'Target user is not a member of this workspace';
  end if;

  update workspace_members set role = 'admin'
  where workspace_id = p_workspace_id and user_id = auth.uid();

  update workspace_members set role = 'owner'
  where workspace_id = p_workspace_id and user_id = p_new_owner_user_id;
end;
$$ language plpgsql security definer set search_path = public, pg_temp;

-- ---------------------------------------------------------------------
-- 10. Invitations: role validation narrowed to ('admin','member'). Body
--     otherwise identical to 005's extensions-qualified pgcrypto version.
-- ---------------------------------------------------------------------
create or replace function create_invitation(
  p_workspace_id uuid, p_email text, p_role text
) returns text as $$
declare
  v_token text;
  v_normalized_email text := lower(trim(p_email));
begin
  if not is_workspace_admin(p_workspace_id) then
    raise exception 'Only an administrator may invite users';
  end if;
  if p_role not in ('admin', 'member') then
    raise exception 'Invalid role';
  end if;

  update invitations set status = 'expired'
  where workspace_id = p_workspace_id and lower(trim(email)) = v_normalized_email
    and status = 'pending' and expires_at <= now();

  v_token := encode(extensions.gen_random_bytes(32), 'hex');

  insert into invitations (workspace_id, email, role, invited_by, token_hash, expires_at)
  values (p_workspace_id, v_normalized_email, p_role, auth.uid(), encode(extensions.digest(v_token, 'sha256'), 'hex'), now() + interval '7 days');

  return v_token;
end;
$$ language plpgsql security definer set search_path = public, pg_temp;

create or replace function accept_invitation(p_token text) returns workspace_members as $$
declare
  v_invite invitations;
  v_member workspace_members;
  v_user_email text;
  v_rows_updated int;
begin
  if auth.uid() is null then
    raise exception 'Authentication required';
  end if;

  select lower(trim(email)) into v_user_email from auth.users where id = auth.uid();
  if v_user_email is null then
    raise exception 'Could not verify authenticated user email';
  end if;

  select * into v_invite from invitations
  where token_hash = encode(extensions.digest(p_token, 'sha256'), 'hex')
  for update;

  if v_invite.id is null then
    raise exception 'Invitation not found';
  end if;
  if v_invite.status = 'accepted' then
    raise exception 'Invitation has already been used';
  end if;
  if v_invite.status = 'revoked' then
    raise exception 'Invitation has been revoked';
  end if;
  if v_invite.status = 'expired' or v_invite.expires_at <= now() then
    update invitations set status = 'expired' where id = v_invite.id;
    raise exception 'Invitation has expired';
  end if;
  if lower(trim(v_invite.email)) <> v_user_email then
    raise exception 'This invitation was issued to a different email address';
  end if;

  update invitations set status = 'accepted', accepted_at = now()
  where id = v_invite.id and status = 'pending';
  get diagnostics v_rows_updated = row_count;
  if v_rows_updated = 0 then
    raise exception 'Invitation was already processed';
  end if;

  insert into workspace_members (workspace_id, user_id, role)
  values (v_invite.workspace_id, auth.uid(), v_invite.role)
  on conflict (workspace_id, user_id) do update set role = excluded.role
  returning * into v_member;

  return v_member;
end;
$$ language plpgsql security definer set search_path = public, pg_temp;

-- ---------------------------------------------------------------------
-- 11. Grants. create or replace preserves prior grants on unchanged
--     functions; re-stated here for the ones actually redefined above.
-- ---------------------------------------------------------------------
revoke execute on function change_member_role(uuid, uuid, text) from public;
revoke execute on function change_member_role(uuid, uuid, text) from anon;
grant execute on function change_member_role(uuid, uuid, text) to authenticated;

revoke execute on function remove_workspace_member(uuid, uuid) from public;
revoke execute on function remove_workspace_member(uuid, uuid) from anon;
grant execute on function remove_workspace_member(uuid, uuid) to authenticated;

revoke execute on function transfer_ownership(uuid, uuid) from public;
revoke execute on function transfer_ownership(uuid, uuid) from anon;
grant execute on function transfer_ownership(uuid, uuid) to authenticated;

revoke execute on function add_workspace_member(uuid, uuid, text) from public;
revoke execute on function add_workspace_member(uuid, uuid, text) from anon;
grant execute on function add_workspace_member(uuid, uuid, text) to authenticated;

revoke execute on function create_workspace(text) from public;
revoke execute on function create_workspace(text) from anon;
grant execute on function create_workspace(text) to authenticated;

revoke execute on function create_invitation(uuid, text, text) from public;
revoke execute on function create_invitation(uuid, text, text) from anon;
grant execute on function create_invitation(uuid, text, text) to authenticated;

revoke execute on function accept_invitation(text) from public;
revoke execute on function accept_invitation(text) from anon;
grant execute on function accept_invitation(text) to authenticated;

revoke execute on function is_workspace_admin(uuid) from public;
revoke execute on function is_workspace_admin(uuid) from anon;
grant execute on function is_workspace_admin(uuid) to authenticated;

-- =====================================================================
-- End of migration 009_role_model_and_permissions.sql
-- =====================================================================
