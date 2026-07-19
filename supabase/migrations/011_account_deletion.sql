-- =====================================================================
-- 011_account_deletion.sql
-- Adds a real, permanent self-service "Delete my account" flow.
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1. Several created_by/uploaded_by columns are currently
--    `not null ... on delete restrict`, which would block deleting any
--    profile that has ever created a folder/task/upload -- i.e. almost
--    every real user. Bring them in line with the pattern already used
--    by completed_by/assigned_to/started_by (nullable, on delete set
--    null): shared content and its attribution survive independently of
--    the account that created it -- deleting your account must not
--    delete folders/tasks/photos other workspace members still rely on.
-- ---------------------------------------------------------------------

alter table workspaces
  alter column created_by drop not null,
  drop constraint workspaces_created_by_fkey,
  add constraint workspaces_created_by_fkey
    foreign key (created_by) references profiles(id) on delete set null;

alter table folders
  alter column created_by drop not null,
  drop constraint folders_created_by_fkey,
  add constraint folders_created_by_fkey
    foreign key (created_by) references profiles(id) on delete set null;

alter table folder_items
  alter column created_by drop not null,
  drop constraint folder_items_created_by_fkey,
  add constraint folder_items_created_by_fkey
    foreign key (created_by) references profiles(id) on delete set null;

alter table folder_item_photos
  alter column uploaded_by drop not null,
  drop constraint folder_item_photos_uploaded_by_fkey,
  add constraint folder_item_photos_uploaded_by_fkey
    foreign key (uploaded_by) references profiles(id) on delete set null;

alter table folder_item_attachments
  alter column uploaded_by drop not null,
  drop constraint folder_item_attachments_uploaded_by_fkey,
  add constraint folder_item_attachments_uploaded_by_fkey
    foreign key (uploaded_by) references profiles(id) on delete set null;

alter table folder_item_voice_notes
  alter column uploaded_by drop not null,
  drop constraint folder_item_voice_notes_uploaded_by_fkey,
  add constraint folder_item_voice_notes_uploaded_by_fkey
    foreign key (uploaded_by) references profiles(id) on delete set null;

-- Legacy v4.1 tables (tasks/task_comments), superseded by folder_items and
-- unused by any current query -- fixed for consistency so a stray
-- historical row can never silently block account deletion.
alter table tasks
  alter column created_by drop not null,
  drop constraint tasks_created_by_fkey,
  add constraint tasks_created_by_fkey
    foreign key (created_by) references profiles(id) on delete set null;

alter table task_comments
  alter column author_id drop not null,
  drop constraint task_comments_author_id_fkey,
  add constraint task_comments_author_id_fkey
    foreign key (author_id) references profiles(id) on delete set null;

-- ---------------------------------------------------------------------
-- 2. delete_own_account() -- the only entry point, takes no parameters
--    and always acts on auth.uid(), which by construction makes it
--    impossible to delete anyone else's account (no privilege-escalation
--    surface to guard against).
--
--    Blocked at the database level (not just hidden in the UI) if the
--    caller still owns any workspace -- they must transfer_ownership()
--    (existing RPC) or delete_workspace() (below) first.
--
--    Deleting auth.users cascades to profiles -> workspace_members,
--    folder_members, user_favorite_items (all already ON DELETE CASCADE)
--    and, after the FK changes above, sets every created_by/uploaded_by
--    referencing this user to NULL instead of blocking. It also cascades
--    through Supabase's own auth.sessions -> auth.refresh_tokens chain,
--    which is the standard, complete way to terminate every session: no
--    refresh token for this user can ever be redeemed again.
--
--    invitations.invited_by is intentionally left ON DELETE RESTRICT --
--    matching rows are explicitly deleted first, since "remove
--    invitations related to that user" is a named requirement, not
--    something that should happen silently via FK cascade.
-- ---------------------------------------------------------------------
create or replace function public.delete_own_account()
returns void
language plpgsql
security definer
set search_path = 'public', 'pg_temp'
as $$
declare
  v_uid uuid := auth.uid();
  v_email text;
  v_owned_count int;
begin
  if v_uid is null then
    raise exception 'Authentication required';
  end if;

  select count(*) into v_owned_count
  from public.workspace_members
  where user_id = v_uid and role = 'owner';

  if v_owned_count > 0 then
    raise exception 'You still own % workspace(s). Transfer ownership or delete the workspace before deleting your account.', v_owned_count;
  end if;

  select email into v_email from auth.users where id = v_uid;

  delete from public.invitations
  where invited_by = v_uid or (v_email is not null and email = v_email);

  delete from auth.users where id = v_uid;
end;
$$;

revoke execute on function public.delete_own_account() from public;
revoke execute on function public.delete_own_account() from anon;
grant execute on function public.delete_own_account() to authenticated;

-- ---------------------------------------------------------------------
-- 3. delete_workspace() -- owner-only. Requirement: an Owner blocked by
--    delete_own_account() above must have a real way to "delete the
--    workspace", not just a message describing the option. Mirrors the
--    existing purge_expired_trash/empty_folder_trash pattern exactly
--    (006_folder_items.sql): collect every Storage (bucket, path) for
--    the workspace via RETURN QUERY *before* the cascading DELETE wipes
--    the rows, so the caller can remove the Storage objects afterward.
-- ---------------------------------------------------------------------
create or replace function public.delete_workspace(p_workspace_id uuid)
returns table (bucket text, path text)
language plpgsql
security definer
set search_path = 'public', 'pg_temp'
as $$
begin
  if not public.is_workspace_owner(p_workspace_id) then
    raise exception 'Only the workspace owner may delete the workspace';
  end if;

  return query
    select 'folder-photos'::text, p.storage_path
      from public.folder_item_photos p
      join public.folder_items i on i.id = p.item_id
      where i.workspace_id = p_workspace_id
    union all
    select 'folder-attachments'::text, a.storage_path
      from public.folder_item_attachments a
      join public.folder_items i on i.id = a.item_id
      where i.workspace_id = p_workspace_id
    union all
    select 'folder-voice'::text, v.storage_path
      from public.folder_item_voice_notes v
      join public.folder_items i on i.id = v.item_id
      where i.workspace_id = p_workspace_id;

  delete from public.workspaces where id = p_workspace_id;
end;
$$;

revoke execute on function public.delete_workspace(uuid) from public;
revoke execute on function public.delete_workspace(uuid) from anon;
grant execute on function public.delete_workspace(uuid) to authenticated;

-- =====================================================================
-- End of migration 011_account_deletion.sql
-- =====================================================================
