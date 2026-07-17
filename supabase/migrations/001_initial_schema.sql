-- =====================================================================
-- 001_initial_schema.sql
-- Family / Business Task Organizer — Database Architecture v4.1 (LOCKED)
-- This single migration merges the approved v4 architecture and the
-- v4.1 corrective patch into one executable file.
--
-- Run in the Supabase SQL editor (service role) before starting the app.
-- Order within this file is dependency-correct: extensions -> tables ->
-- constraints/indexes -> helper fns -> RLS -> triggers -> RPCs -> grants.
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1. Extensions
-- ---------------------------------------------------------------------
create extension if not exists "pgcrypto";

-- ---------------------------------------------------------------------
-- 2. Core tables
-- ---------------------------------------------------------------------
create table profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text not null check (length(trim(full_name)) > 0),
  avatar_url text,
  created_at timestamptz not null default now()
);

create table workspaces (
  id uuid primary key default gen_random_uuid(),
  name text not null check (length(trim(name)) > 0),
  created_by uuid not null references profiles(id) on delete restrict,
  created_at timestamptz not null default now()
);

create table workspace_members (
  workspace_id uuid not null references workspaces(id) on delete cascade,
  user_id uuid not null references profiles(id) on delete cascade,
  role text not null check (role in ('admin','worker')),
  joined_at timestamptz not null default now(),
  primary key (workspace_id, user_id)
);

create table folders (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references workspaces(id) on delete cascade,
  name text not null check (length(trim(name)) > 0),
  color text,
  icon text,
  position integer not null default 0,   -- user-defined ordering for drag & drop (v4.2)
  created_by uuid not null references profiles(id) on delete restrict,
  archived_at timestamptz,
  created_at timestamptz not null default now()
);

create table folder_members (
  folder_id uuid not null references folders(id) on delete cascade,
  user_id uuid not null references profiles(id) on delete cascade,
  can_view boolean not null default true,
  can_create_tasks boolean not null default false,
  can_edit_tasks boolean not null default false,
  can_complete_tasks boolean not null default true,
  can_comment boolean not null default true,
  created_at timestamptz not null default now(),
  primary key (folder_id, user_id)
);

create table tasks (
  id uuid primary key default gen_random_uuid(),
  folder_id uuid not null references folders(id) on delete cascade,
  title text not null check (length(trim(title)) > 0),
  description text,
  status text not null default 'todo' check (status in ('todo','in_progress','done')),
  due_date date,
  due_time time,
  assigned_to uuid references profiles(id) on delete set null,
  created_by uuid not null references profiles(id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  started_by uuid references profiles(id) on delete set null,
  started_at timestamptz,
  completed_by uuid references profiles(id) on delete set null,
  completed_at timestamptz,
  archived_at timestamptz,
  constraint due_time_requires_due_date check (due_time is null or due_date is not null),
  constraint started_consistency check ((started_by is null) = (started_at is null)),
  constraint completed_consistency check ((completed_by is null) = (completed_at is null))
);

create table task_comments (
  id uuid primary key default gen_random_uuid(),
  task_id uuid not null references tasks(id) on delete cascade,
  author_id uuid not null references profiles(id) on delete restrict,
  content text not null check (length(trim(content)) > 0 and length(content) <= 2000),
  comment_type text not null default 'note' check (comment_type in ('note','completion')),
  created_at timestamptz not null default now(),
  edited_at timestamptz
);

create table task_activity (
  id uuid primary key default gen_random_uuid(),
  task_id uuid not null references tasks(id) on delete cascade,
  actor_id uuid references profiles(id) on delete set null,
  action_type text not null check (action_type in (
    'created','edited','status_changed','completed','completion_removed',
    'assignment_changed','date_changed','comment_added','comment_edited',
    'comment_deleted','archived','restored'
  )),
  old_values jsonb,
  new_values jsonb,
  created_at timestamptz not null default now()
);

create table invitations (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references workspaces(id) on delete cascade,
  email text not null check (length(trim(email)) > 0),
  role text not null check (role in ('admin','worker')),
  invited_by uuid not null references profiles(id) on delete restrict,
  token_hash text not null,
  status text not null default 'pending' check (status in ('pending','accepted','revoked','expired')),
  expires_at timestamptz not null,
  accepted_at timestamptz,
  created_at timestamptz not null default now(),
  constraint accepted_requires_timestamp check (status <> 'accepted' or accepted_at is not null)
);

-- ---------------------------------------------------------------------
-- 3. Constraints & indexes
-- ---------------------------------------------------------------------
alter table invitations add constraint invitations_token_hash_unique unique (token_hash);

create unique index invitations_pending_unique
  on invitations(lower(trim(email)), workspace_id) where status = 'pending';

create index idx_workspace_members_user_ws on workspace_members(user_id, workspace_id);
create index idx_folders_workspace on folders(workspace_id);
create index idx_folders_workspace_position on folders(workspace_id, position);
create index idx_folder_members_user_folder on folder_members(user_id, folder_id);
create index idx_tasks_folder_due_status on tasks(folder_id, due_date, status);
create index idx_tasks_assigned_to on tasks(assigned_to);
create index idx_task_comments_task_created on task_comments(task_id, created_at);
create index idx_task_activity_task_created on task_activity(task_id, created_at);
create index idx_invitations_token_hash on invitations(token_hash);
create index idx_invitations_email_ws on invitations(lower(trim(email)), workspace_id);

create or replace function set_updated_at() returns trigger as $$
begin
  new.updated_at := now();
  return new;
end;
$$ language plpgsql set search_path = public, pg_temp;

create trigger trg_tasks_updated_at before update on tasks
for each row execute function set_updated_at();

-- ---------------------------------------------------------------------
-- 4. Helper functions (SECURITY DEFINER, fixed search_path)
-- ---------------------------------------------------------------------
create or replace function is_workspace_admin(ws_id uuid) returns boolean as $$
  select exists (
    select 1 from public.workspace_members
    where workspace_id = ws_id and user_id = auth.uid() and role = 'admin'
  );
$$ language sql security definer stable set search_path = public, pg_temp;

create or replace function is_workspace_member(ws_id uuid) returns boolean as $$
  select exists (
    select 1 from public.workspace_members
    where workspace_id = ws_id and user_id = auth.uid()
  );
$$ language sql security definer stable set search_path = public, pg_temp;

create or replace function is_folder_admin(f_id uuid) returns boolean as $$
  select exists (
    select 1 from public.folders f
    where f.id = f_id and public.is_workspace_admin(f.workspace_id)
  );
$$ language sql security definer stable set search_path = public, pg_temp;

create or replace function folder_permission(f_id uuid, perm text) returns boolean as $$
  select case
    when public.is_folder_admin(f_id) then true
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

-- ---------------------------------------------------------------------
-- 5. Enable RLS + policies
-- ---------------------------------------------------------------------
alter table profiles enable row level security;
alter table workspaces enable row level security;
alter table workspace_members enable row level security;
alter table folders enable row level security;
alter table folder_members enable row level security;
alter table tasks enable row level security;
alter table task_comments enable row level security;
alter table task_activity enable row level security;
alter table invitations enable row level security;

-- profiles: self + shared-workspace members only
create policy profiles_select on profiles for select
using (
  id = auth.uid()
  or exists (
    select 1 from workspace_members wm1
    join workspace_members wm2 on wm1.workspace_id = wm2.workspace_id
    where wm1.user_id = auth.uid() and wm2.user_id = profiles.id
  )
);
create policy profiles_self_update on profiles for update using (id = auth.uid());

-- workspaces
create policy workspaces_select on workspaces for select
using (is_workspace_member(id));
create policy workspaces_admin_update on workspaces for update
using (is_workspace_admin(id))
with check (is_workspace_admin(id));
-- no insert policy (create_workspace RPC only); no delete policy

-- workspace_members: read-only for clients; writes via RPC
create policy wsm_select on workspace_members for select
using (user_id = auth.uid() or is_workspace_admin(workspace_id));

-- folders
create policy folders_select on folders for select
using (is_workspace_admin(workspace_id) or folder_permission(id, 'view'));
create policy folders_admin_insert on folders for insert
with check (is_workspace_admin(workspace_id));
create policy folders_admin_update on folders for update
using (is_workspace_admin(workspace_id))
with check (is_workspace_admin(workspace_id));
-- no delete policy (archive via update)

-- folder_members: read-only for clients; writes via RPC
create policy folder_members_select on folder_members for select
using (user_id = auth.uid() or is_folder_admin(folder_id));

-- tasks
create policy tasks_select on tasks for select
using (folder_permission(folder_id, 'view'));
create policy tasks_admin_insert on tasks for insert
with check (is_folder_admin(folder_id));
create policy tasks_worker_insert on tasks for insert
with check (folder_permission(folder_id, 'create'));
create policy tasks_admin_update on tasks for update
using (is_folder_admin(folder_id))
with check (is_folder_admin(folder_id));
create policy tasks_worker_update on tasks for update
using (
  folder_permission(folder_id, 'edit')
  or (folder_permission(folder_id, 'complete') and (assigned_to is null or assigned_to = auth.uid()))
)
with check (
  folder_permission(folder_id, 'edit')
  or (folder_permission(folder_id, 'complete') and (assigned_to is null or assigned_to = auth.uid()))
);
-- no delete policy (archive only)

-- task_comments
create policy comments_select on task_comments for select
using (exists (select 1 from tasks t where t.id = task_id and folder_permission(t.folder_id, 'view')));
create policy comments_insert on task_comments for insert
with check (
  exists (
    select 1 from tasks t where t.id = task_id
    and (is_folder_admin(t.folder_id) or folder_permission(t.folder_id, 'comment'))
  )
);
create policy comments_update on task_comments for update
using (author_id = auth.uid() or exists (select 1 from tasks t where t.id = task_id and is_folder_admin(t.folder_id)));
create policy comments_delete on task_comments for delete
using (author_id = auth.uid() or exists (select 1 from tasks t where t.id = task_id and is_folder_admin(t.folder_id)));

-- task_activity: read-only, server writes only
create policy activity_select on task_activity for select
using (exists (select 1 from tasks t where t.id = task_id and folder_permission(t.folder_id, 'view')));

-- invitations: admin read; lifecycle via RPC
create policy invitations_admin_select on invitations for select
using (is_workspace_admin(workspace_id));

-- ---------------------------------------------------------------------
-- 6. Identity / protection triggers
-- ---------------------------------------------------------------------

-- Profile bootstrap on Supabase Auth signup (v4.1 patch §2)
create or replace function handle_new_user() returns trigger as $$
begin
  insert into public.profiles (id, full_name)
  values (
    new.id,
    coalesce(nullif(trim(new.raw_user_meta_data->>'full_name'), ''), 'New User')
  )
  on conflict (id) do nothing;
  return new;
end;
$$ language plpgsql security definer set search_path = public, pg_temp;

create trigger trg_handle_new_user
after insert on auth.users
for each row execute function handle_new_user();

-- Task insert identity (v4 §6)
create or replace function protect_task_insert() returns trigger as $$
begin
  new.created_by := auth.uid();
  new.created_at := now();
  new.updated_at := now();
  new.status := 'todo';
  new.started_by := null;
  new.started_at := null;
  new.completed_by := null;
  new.completed_at := null;
  new.archived_at := null;
  return new;
end;
$$ language plpgsql security definer set search_path = public, pg_temp;

create trigger trg_protect_task_insert
before insert on tasks
for each row execute function protect_task_insert();

-- Folder insert identity (v4.1 patch §3)
create or replace function protect_folder_insert() returns trigger as $$
begin
  new.created_by := auth.uid();
  new.created_at := now();
  new.archived_at := null;
  return new;
end;
$$ language plpgsql security definer set search_path = public, pg_temp;

create trigger trg_protect_folder_insert
before insert on folders
for each row execute function protect_folder_insert();

-- Workspace immutable-field protection (v4.1 patch §4)
create or replace function protect_workspace_update() returns trigger as $$
begin
  new.id := old.id;
  new.created_by := old.created_by;
  new.created_at := old.created_at;
  return new;
end;
$$ language plpgsql security definer set search_path = public, pg_temp;

create trigger trg_protect_workspace_update
before update on workspaces
for each row execute function protect_workspace_update();

-- Task assignment + folder-move validation (v4 §6 + v4.1 patch §6)
create or replace function validate_task_assignment() returns trigger as $$
begin
  if tg_op = 'UPDATE' and new.folder_id is distinct from old.folder_id then
    if (select workspace_id from folders where id = new.folder_id)
       is distinct from
       (select workspace_id from folders where id = old.folder_id)
    then
      raise exception 'A task may only be moved within the same workspace';
    end if;
  end if;

  if new.assigned_to is not null then
    if not exists (
      select 1 from folders f
      join workspace_members wm on wm.workspace_id = f.workspace_id
      where f.id = new.folder_id and wm.user_id = new.assigned_to
    ) then
      raise exception 'Assigned user is not a member of this task''s workspace';
    end if;

    if not exists (
      select 1 from folders f
      join workspace_members wm on wm.workspace_id = f.workspace_id
        and wm.user_id = new.assigned_to and wm.role = 'admin'
      where f.id = new.folder_id
    ) and not exists (
      select 1 from folder_members fm
      where fm.folder_id = new.folder_id and fm.user_id = new.assigned_to and fm.can_view = true
    ) then
      raise exception 'Assigned user does not have access to this folder';
    end if;
  end if;

  return new;
end;
$$ language plpgsql security definer set search_path = public, pg_temp;

create trigger trg_validate_task_assignment
before insert or update of assigned_to, folder_id on tasks
for each row execute function validate_task_assignment();

-- Task field protection + status guards (v4 §6 + v4.1 patch §6)
create or replace function protect_task_fields() returns trigger as $$
declare
  v_is_admin boolean;
  v_can_edit boolean;
begin
  v_is_admin := is_folder_admin(new.folder_id);
  v_can_edit := folder_permission(new.folder_id, 'edit');

  if not v_is_admin and new.folder_id is distinct from old.folder_id then
    raise exception 'Workers may not move tasks between folders';
  end if;

  new.created_by := old.created_by;
  new.created_at := old.created_at;

  if not v_is_admin and old.status = 'done' and new.status in ('todo','in_progress') then
    raise exception 'Only an administrator may reopen a completed task';
  end if;

  if not v_is_admin and new.status is distinct from old.status then
    if old.assigned_to is not null and old.assigned_to <> auth.uid() then
      raise exception 'You may only start or complete tasks assigned to you';
    end if;
  end if;

  if not v_is_admin and not v_can_edit then
    if new.title is distinct from old.title
      or new.description is distinct from old.description
      or new.due_date is distinct from old.due_date
      or new.due_time is distinct from old.due_time
      or new.assigned_to is distinct from old.assigned_to
      or new.folder_id is distinct from old.folder_id
      or new.archived_at is distinct from old.archived_at
    then
      raise exception 'You do not have permission to edit this field';
    end if;
  end if;

  new.started_by := old.started_by;
  new.started_at := old.started_at;
  new.completed_by := old.completed_by;
  new.completed_at := old.completed_at;

  if new.status = 'in_progress' and old.status = 'todo' then
    new.started_by := auth.uid();
    new.started_at := now();
  end if;

  if new.status = 'done' and old.status <> 'done' then
    new.completed_by := auth.uid();
    new.completed_at := now();
  end if;

  if new.status <> 'done' and old.status = 'done' then
    new.completed_by := null;
    new.completed_at := null;
  end if;

  return new;
end;
$$ language plpgsql security definer set search_path = public, pg_temp;

create trigger trg_protect_task_fields
before update on tasks
for each row execute function protect_task_fields();

-- Comment identity + immutable-field protection (v4 §6 + v4.1 patch §5)
create or replace function protect_comment_identity() returns trigger as $$
begin
  if tg_op = 'INSERT' then
    new.author_id := auth.uid();
  elsif tg_op = 'UPDATE' then
    new.id := old.id;
    new.task_id := old.task_id;
    new.author_id := old.author_id;
    new.comment_type := old.comment_type;
    new.created_at := old.created_at;
    new.edited_at := now();
  end if;
  return new;
end;
$$ language plpgsql security definer set search_path = public, pg_temp;

create trigger trg_protect_comment_identity
before insert or update on task_comments
for each row execute function protect_comment_identity();

-- Folder-member workspace validation (v4 §7)
create or replace function validate_folder_member_workspace() returns trigger as $$
begin
  if not exists (
    select 1 from folders f
    join workspace_members wm on wm.workspace_id = f.workspace_id
    where f.id = new.folder_id and wm.user_id = new.user_id
  ) then
    raise exception 'User must be a workspace member before being granted folder access';
  end if;
  return new;
end;
$$ language plpgsql security definer set search_path = public, pg_temp;

create trigger trg_validate_folder_member_workspace
before insert or update on folder_members
for each row execute function validate_folder_member_workspace();

-- Cleanup folder access when a member is removed from a workspace (v4 §7)
create or replace function cleanup_folder_access_on_membership_removal() returns trigger as $$
begin
  delete from folder_members fm
  using folders f
  where fm.folder_id = f.id
    and f.workspace_id = old.workspace_id
    and fm.user_id = old.user_id;
  return old;
end;
$$ language plpgsql security definer set search_path = public, pg_temp;

create trigger trg_cleanup_folder_access
after delete on workspace_members
for each row execute function cleanup_folder_access_on_membership_removal();

-- ---------------------------------------------------------------------
-- 7. Audit triggers (task_activity)
-- ---------------------------------------------------------------------
create or replace function log_task_activity() returns trigger as $$
begin
  if tg_op = 'INSERT' then
    insert into task_activity (task_id, actor_id, action_type, new_values)
    values (new.id, auth.uid(), 'created', to_jsonb(new));
    return new;
  end if;

  if tg_op = 'UPDATE' then
    if new.status is distinct from old.status then
      if new.status = 'in_progress' then
        insert into task_activity (task_id, actor_id, action_type, old_values, new_values)
        values (new.id, auth.uid(), 'status_changed', jsonb_build_object('status', old.status), jsonb_build_object('status', new.status));
      elsif new.status = 'done' then
        insert into task_activity (task_id, actor_id, action_type, new_values)
        values (new.id, auth.uid(), 'completed', jsonb_build_object('completed_by', new.completed_by, 'completed_at', new.completed_at));
      elsif old.status = 'done' then
        insert into task_activity (task_id, actor_id, action_type, old_values)
        values (new.id, auth.uid(), 'completion_removed', jsonb_build_object('was_completed_by', old.completed_by));
      end if;
    end if;

    if new.assigned_to is distinct from old.assigned_to then
      insert into task_activity (task_id, actor_id, action_type, old_values, new_values)
      values (new.id, auth.uid(), 'assignment_changed', jsonb_build_object('assigned_to', old.assigned_to), jsonb_build_object('assigned_to', new.assigned_to));
    end if;

    if new.due_date is distinct from old.due_date or new.due_time is distinct from old.due_time then
      insert into task_activity (task_id, actor_id, action_type, old_values, new_values)
      values (new.id, auth.uid(), 'date_changed',
        jsonb_build_object('due_date', old.due_date, 'due_time', old.due_time),
        jsonb_build_object('due_date', new.due_date, 'due_time', new.due_time));
    end if;

    if new.archived_at is distinct from old.archived_at then
      insert into task_activity (task_id, actor_id, action_type)
      values (new.id, auth.uid(), case when new.archived_at is null then 'restored' else 'archived' end);
    end if;

    if new.title is distinct from old.title or new.description is distinct from old.description then
      insert into task_activity (task_id, actor_id, action_type, old_values, new_values)
      values (new.id, auth.uid(), 'edited',
        jsonb_build_object('title', old.title, 'description', old.description),
        jsonb_build_object('title', new.title, 'description', new.description));
    end if;
  end if;

  return new;
end;
$$ language plpgsql security definer set search_path = public, pg_temp;

create trigger trg_log_task_activity
after insert or update on tasks
for each row execute function log_task_activity();

create or replace function log_comment_activity() returns trigger as $$
begin
  if tg_op = 'INSERT' then
    insert into task_activity (task_id, actor_id, action_type, new_values)
    values (new.task_id, auth.uid(), 'comment_added', jsonb_build_object('comment_id', new.id));
  elsif tg_op = 'UPDATE' then
    insert into task_activity (task_id, actor_id, action_type, old_values)
    values (new.task_id, auth.uid(), 'comment_edited', jsonb_build_object('comment_id', new.id));
  elsif tg_op = 'DELETE' then
    insert into task_activity (task_id, actor_id, action_type, old_values)
    values (old.task_id, auth.uid(), 'comment_deleted', jsonb_build_object('comment_id', old.id));
  end if;
  return coalesce(new, old);
end;
$$ language plpgsql security definer set search_path = public, pg_temp;

create trigger trg_log_comment_activity
after insert or update or delete on task_comments
for each row execute function log_comment_activity();

-- ---------------------------------------------------------------------
-- 8. Secure RPCs
-- ---------------------------------------------------------------------

-- Workspace bootstrap (v4 §9.1, revised v4.2)
-- Creates an EMPTY workspace. No demo/sample folders are seeded — every user
-- builds their own folder structure from scratch ("blank filing cabinet").
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
  values (v_workspace.id, auth.uid(), 'admin');

  return v_workspace;
end;
$$ language plpgsql security definer set search_path = public, pg_temp;

-- Membership management (v4 §9.2)
create or replace function add_workspace_member(
  p_workspace_id uuid, p_user_id uuid, p_role text
) returns workspace_members as $$
declare v_member workspace_members;
begin
  if not is_workspace_admin(p_workspace_id) then
    raise exception 'Only an administrator may add members';
  end if;
  if p_role not in ('admin','worker') then
    raise exception 'Invalid role';
  end if;

  insert into workspace_members (workspace_id, user_id, role)
  values (p_workspace_id, p_user_id, p_role)
  on conflict (workspace_id, user_id) do update set role = excluded.role
  returning * into v_member;

  return v_member;
end;
$$ language plpgsql security definer set search_path = public, pg_temp;

create or replace function change_member_role(
  p_workspace_id uuid, p_user_id uuid, p_new_role text
) returns workspace_members as $$
declare
  v_admin_count int;
  v_current_role text;
  v_member workspace_members;
begin
  if not is_workspace_admin(p_workspace_id) then
    raise exception 'Only an administrator may change roles';
  end if;
  if p_new_role not in ('admin','worker') then
    raise exception 'Invalid role';
  end if;

  select role into v_current_role from workspace_members
  where workspace_id = p_workspace_id and user_id = p_user_id
  for update;

  if v_current_role is null then
    raise exception 'User is not a member of this workspace';
  end if;

  if v_current_role = 'admin' and p_new_role = 'worker' then
    select count(*) into v_admin_count from workspace_members
    where workspace_id = p_workspace_id and role = 'admin';
    if v_admin_count <= 1 then
      raise exception 'Cannot demote the last administrator of a workspace';
    end if;
  end if;

  update workspace_members set role = p_new_role
  where workspace_id = p_workspace_id and user_id = p_user_id
  returning * into v_member;

  return v_member;
end;
$$ language plpgsql security definer set search_path = public, pg_temp;

create or replace function remove_workspace_member(
  p_workspace_id uuid, p_user_id uuid
) returns void as $$
declare
  v_role text;
  v_admin_count int;
begin
  if not is_workspace_admin(p_workspace_id) then
    raise exception 'Only an administrator may remove members';
  end if;

  select role into v_role from workspace_members
  where workspace_id = p_workspace_id and user_id = p_user_id
  for update;

  if v_role is null then
    raise exception 'User is not a member of this workspace';
  end if;

  if v_role = 'admin' then
    select count(*) into v_admin_count from workspace_members
    where workspace_id = p_workspace_id and role = 'admin';
    if v_admin_count <= 1 then
      raise exception 'Cannot remove the last administrator of a workspace';
    end if;
  end if;

  delete from workspace_members
  where workspace_id = p_workspace_id and user_id = p_user_id;
end;
$$ language plpgsql security definer set search_path = public, pg_temp;

-- Folder permission management (v4 §9.3)
create or replace function grant_folder_access(
  p_folder_id uuid, p_user_id uuid,
  p_can_view boolean default true, p_can_create_tasks boolean default false,
  p_can_edit_tasks boolean default false, p_can_complete_tasks boolean default true,
  p_can_comment boolean default true
) returns folder_members as $$
declare v_fm folder_members;
begin
  if not is_folder_admin(p_folder_id) then
    raise exception 'Only an administrator may grant folder access';
  end if;

  insert into folder_members (folder_id, user_id, can_view, can_create_tasks, can_edit_tasks, can_complete_tasks, can_comment)
  values (p_folder_id, p_user_id, p_can_view, p_can_create_tasks, p_can_edit_tasks, p_can_complete_tasks, p_can_comment)
  on conflict (folder_id, user_id) do update set
    can_view = excluded.can_view, can_create_tasks = excluded.can_create_tasks,
    can_edit_tasks = excluded.can_edit_tasks, can_complete_tasks = excluded.can_complete_tasks,
    can_comment = excluded.can_comment
  returning * into v_fm;

  return v_fm;
end;
$$ language plpgsql security definer set search_path = public, pg_temp;

create or replace function update_folder_permissions(
  p_folder_id uuid, p_user_id uuid,
  p_can_view boolean, p_can_create_tasks boolean, p_can_edit_tasks boolean,
  p_can_complete_tasks boolean, p_can_comment boolean
) returns folder_members as $$
declare v_fm folder_members;
begin
  if not is_folder_admin(p_folder_id) then
    raise exception 'Only an administrator may update folder permissions';
  end if;

  update folder_members set
    can_view = p_can_view, can_create_tasks = p_can_create_tasks,
    can_edit_tasks = p_can_edit_tasks, can_complete_tasks = p_can_complete_tasks,
    can_comment = p_can_comment
  where folder_id = p_folder_id and user_id = p_user_id
  returning * into v_fm;

  if v_fm.folder_id is null then
    raise exception 'No existing folder access to update — use grant_folder_access instead';
  end if;

  return v_fm;
end;
$$ language plpgsql security definer set search_path = public, pg_temp;

create or replace function revoke_folder_access(
  p_folder_id uuid, p_user_id uuid
) returns void as $$
begin
  if not is_folder_admin(p_folder_id) then
    raise exception 'Only an administrator may revoke folder access';
  end if;

  delete from folder_members where folder_id = p_folder_id and user_id = p_user_id;
end;
$$ language plpgsql security definer set search_path = public, pg_temp;

-- Invitations (v4 §9.4)
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
  if p_role not in ('admin','worker') then
    raise exception 'Invalid role';
  end if;

  update invitations set status = 'expired'
  where workspace_id = p_workspace_id and lower(trim(email)) = v_normalized_email
    and status = 'pending' and expires_at <= now();

  v_token := encode(gen_random_bytes(32), 'hex');

  insert into invitations (workspace_id, email, role, invited_by, token_hash, expires_at)
  values (p_workspace_id, v_normalized_email, p_role, auth.uid(), encode(digest(v_token, 'sha256'), 'hex'), now() + interval '7 days');

  return v_token;
end;
$$ language plpgsql security definer set search_path = public, pg_temp;

create or replace function revoke_invitation(p_invitation_id uuid) returns void as $$
declare v_ws_id uuid;
begin
  select workspace_id into v_ws_id from invitations where id = p_invitation_id;
  if not is_workspace_admin(v_ws_id) then
    raise exception 'Only an administrator may revoke an invitation';
  end if;

  update invitations set status = 'revoked'
  where id = p_invitation_id and status = 'pending';
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
  where token_hash = encode(digest(p_token, 'sha256'), 'hex')
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

-- Task completion + archive/restore (v4 §9.5)
create or replace function complete_task(
  p_task_id uuid, p_comment text default null
) returns tasks as $$
declare
  v_task tasks;
  v_folder_id uuid;
  v_assigned_to uuid;
  v_status text;
  v_archived_at timestamptz;
  v_is_admin boolean;
  v_comment text;
begin
  if auth.uid() is null then
    raise exception 'Authentication required';
  end if;

  select folder_id, assigned_to, status, archived_at
  into v_folder_id, v_assigned_to, v_status, v_archived_at
  from tasks where id = p_task_id
  for update;

  if v_folder_id is null then
    raise exception 'Task not found';
  end if;
  if v_archived_at is not null then
    raise exception 'Cannot complete an archived task';
  end if;
  if v_status = 'done' then
    raise exception 'Task is already completed';
  end if;

  v_is_admin := is_folder_admin(v_folder_id);

  if not v_is_admin then
    if not folder_permission(v_folder_id, 'complete') then
      raise exception 'You do not have permission to complete tasks in this folder';
    end if;
    if v_assigned_to is not null and v_assigned_to <> auth.uid() then
      raise exception 'This task is assigned to someone else';
    end if;
  end if;

  update tasks set status = 'done' where id = p_task_id returning * into v_task;

  if p_comment is not null then
    v_comment := left(trim(p_comment), 2000);
    if length(v_comment) > 0 then
      insert into task_comments (task_id, content, comment_type)
      values (p_task_id, v_comment, 'completion');
    end if;
  end if;

  return v_task;
end;
$$ language plpgsql security definer set search_path = public, pg_temp;

create or replace function archive_task(p_task_id uuid) returns tasks as $$
declare v_task tasks; v_folder_id uuid;
begin
  select folder_id into v_folder_id from tasks where id = p_task_id;
  if v_folder_id is null then
    raise exception 'Task not found';
  end if;
  if not is_folder_admin(v_folder_id) then
    raise exception 'Only an administrator may archive tasks';
  end if;

  update tasks set archived_at = now() where id = p_task_id returning * into v_task;
  return v_task;
end;
$$ language plpgsql security definer set search_path = public, pg_temp;

create or replace function restore_task(p_task_id uuid) returns tasks as $$
declare v_task tasks; v_folder_id uuid;
begin
  select folder_id into v_folder_id from tasks where id = p_task_id;
  if v_folder_id is null then
    raise exception 'Task not found';
  end if;
  if not is_folder_admin(v_folder_id) then
    raise exception 'Only an administrator may restore tasks';
  end if;

  update tasks set archived_at = null where id = p_task_id returning * into v_task;
  return v_task;
end;
$$ language plpgsql security definer set search_path = public, pg_temp;

-- ---------------------------------------------------------------------
-- 9. Function grants (v4 §10 + v4.1 patch §1)
-- ---------------------------------------------------------------------
revoke execute on all functions in schema public from public;

-- Helper functions: required by RLS policy expressions
grant execute on function is_workspace_admin(uuid) to authenticated;
grant execute on function is_workspace_member(uuid) to authenticated;
grant execute on function is_folder_admin(uuid) to authenticated;
grant execute on function folder_permission(uuid, text) to authenticated;

-- Client-callable RPCs
grant execute on function create_workspace(text) to authenticated;
grant execute on function add_workspace_member(uuid, uuid, text) to authenticated;
grant execute on function change_member_role(uuid, uuid, text) to authenticated;
grant execute on function remove_workspace_member(uuid, uuid) to authenticated;
grant execute on function grant_folder_access(uuid, uuid, boolean, boolean, boolean, boolean, boolean) to authenticated;
grant execute on function update_folder_permissions(uuid, uuid, boolean, boolean, boolean, boolean, boolean) to authenticated;
grant execute on function revoke_folder_access(uuid, uuid) to authenticated;
grant execute on function create_invitation(uuid, text, text) to authenticated;
grant execute on function revoke_invitation(uuid) to authenticated;
grant execute on function accept_invitation(text) to authenticated;
grant execute on function complete_task(uuid, text) to authenticated;
grant execute on function archive_task(uuid) to authenticated;
grant execute on function restore_task(uuid) to authenticated;

-- Trigger functions intentionally receive NO execute grant to authenticated:
--   handle_new_user, set_updated_at, protect_task_insert, protect_folder_insert,
--   protect_workspace_update, validate_task_assignment, protect_task_fields,
--   protect_comment_identity, validate_folder_member_workspace,
--   cleanup_folder_access_on_membership_removal, log_task_activity, log_comment_activity
-- They fire automatically as triggers regardless of EXECUTE privilege.

-- =====================================================================
-- End of migration 001_initial_schema.sql
-- =====================================================================
