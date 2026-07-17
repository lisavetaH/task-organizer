-- =====================================================================
-- 006_folder_items.sql  (Phase 3 — collaborative notebook content)
-- Depends on 001-005. Nothing in 001-005 is modified.
--
-- Adds: folder_items, folder_item_photos, folder_item_attachments,
-- folder_item_voice_notes, user_favorite_items; their RLS; identity/audit
-- triggers; secure RPCs (reorder, duplicate, trash purge); and Storage
-- policies for THREE private buckets.
--
-- MANUAL STEP (cannot be done from SQL): create three PRIVATE Storage
-- buckets in the dashboard — 'folder-photos', 'folder-attachments',
-- 'folder-voice'. Leave "Public" unchecked on all three. The
-- storage.objects policies below then govern access by folder permission.
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1. Tables
-- ---------------------------------------------------------------------
create table folder_items (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references workspaces(id) on delete cascade,
  folder_id uuid not null references folders(id) on delete cascade,
  title text,
  body text,
  item_type text not null default 'note' check (item_type in ('note','task')),
  scheduled_date date,
  scheduled_time time,
  is_pinned boolean not null default false,
  position integer not null default 0,
  completed_at timestamptz,
  completed_by uuid references profiles(id) on delete set null,
  created_by uuid not null references profiles(id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  archived_at timestamptz,               -- soft delete -> Trash
  constraint item_time_requires_date check (scheduled_time is null or scheduled_date is not null),
  constraint item_completed_consistency check ((completed_by is null) = (completed_at is null)),
  constraint item_has_content check (
    (title is not null and length(trim(title)) > 0)
    or (body is not null and length(trim(body)) > 0)
  )
);

create table folder_item_photos (
  id uuid primary key default gen_random_uuid(),
  item_id uuid not null references folder_items(id) on delete cascade,
  folder_id uuid not null references folders(id) on delete cascade,
  storage_path text not null unique,
  original_filename text,
  mime_type text,
  size_bytes integer,
  position integer not null default 0,
  uploaded_by uuid not null references profiles(id) on delete restrict,
  created_at timestamptz not null default now()
);

create table folder_item_attachments (
  id uuid primary key default gen_random_uuid(),
  item_id uuid not null references folder_items(id) on delete cascade,
  folder_id uuid not null references folders(id) on delete cascade,
  storage_path text not null unique,
  original_filename text,
  mime_type text,
  size_bytes integer,
  position integer not null default 0,
  uploaded_by uuid not null references profiles(id) on delete restrict,
  created_at timestamptz not null default now()
);

create table folder_item_voice_notes (
  id uuid primary key default gen_random_uuid(),
  item_id uuid not null references folder_items(id) on delete cascade,
  folder_id uuid not null references folders(id) on delete cascade,
  storage_path text not null unique,
  original_filename text,
  mime_type text,
  size_bytes integer,
  duration_seconds integer,
  position integer not null default 0,
  uploaded_by uuid not null references profiles(id) on delete restrict,
  created_at timestamptz not null default now()
);

create table user_favorite_items (
  user_id uuid not null references profiles(id) on delete cascade,
  item_id uuid not null references folder_items(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (user_id, item_id)
);

-- ---------------------------------------------------------------------
-- 2. Indexes
-- ---------------------------------------------------------------------
create index idx_items_folder_live on folder_items(folder_id, is_pinned desc, position, created_at desc) where archived_at is null;
create index idx_items_folder_trash on folder_items(folder_id, archived_at) where archived_at is not null;
create index idx_items_ws_sched on folder_items(workspace_id, scheduled_date) where archived_at is null;
create index idx_items_ws_text on folder_items(workspace_id) where archived_at is null;
create index idx_photos_item on folder_item_photos(item_id, position);
create index idx_photos_folder on folder_item_photos(folder_id);
create index idx_attach_item on folder_item_attachments(item_id, position);
create index idx_attach_folder on folder_item_attachments(folder_id);
create index idx_voice_item on folder_item_voice_notes(item_id, position);
create index idx_voice_folder on folder_item_voice_notes(folder_id);
create index idx_favorites_user on user_favorite_items(user_id);

-- ---------------------------------------------------------------------
-- 3. Identity / audit triggers
-- ---------------------------------------------------------------------
create or replace function protect_item_insert() returns trigger as $$
begin
  new.created_by := auth.uid();
  new.created_at := now();
  new.updated_at := now();
  new.completed_by := null;
  new.completed_at := null;
  new.archived_at := null;
  new.workspace_id := (select workspace_id from folders where id = new.folder_id);
  if new.workspace_id is null then
    raise exception 'Folder not found';
  end if;
  return new;
end;
$$ language plpgsql security definer set search_path = public, pg_temp;

create trigger trg_protect_item_insert
before insert on folder_items
for each row execute function protect_item_insert();

create or replace function protect_item_update() returns trigger as $$
begin
  new.folder_id := old.folder_id;
  new.workspace_id := old.workspace_id;
  new.created_by := old.created_by;
  new.created_at := old.created_at;
  new.updated_at := now();

  if new.completed_at is not null and old.completed_at is null then
    new.completed_by := auth.uid();
    new.completed_at := now();
  elsif new.completed_at is null and old.completed_at is not null then
    new.completed_by := null;
  else
    new.completed_by := old.completed_by;
    new.completed_at := old.completed_at;
  end if;

  return new;
end;
$$ language plpgsql security definer set search_path = public, pg_temp;

create trigger trg_protect_item_update
before update on folder_items
for each row execute function protect_item_update();

-- Media inserts: server owns uploaded_by/created_at, derives folder_id.
create or replace function protect_media_insert() returns trigger as $$
begin
  new.uploaded_by := auth.uid();
  new.created_at := now();
  new.folder_id := (select folder_id from folder_items where id = new.item_id);
  if new.folder_id is null then
    raise exception 'Item not found';
  end if;
  return new;
end;
$$ language plpgsql security definer set search_path = public, pg_temp;

create trigger trg_protect_photo_insert  before insert on folder_item_photos      for each row execute function protect_media_insert();
create trigger trg_protect_attach_insert before insert on folder_item_attachments for each row execute function protect_media_insert();
create trigger trg_protect_voice_insert  before insert on folder_item_voice_notes for each row execute function protect_media_insert();

create trigger trg_items_updated_at before update on folder_items
for each row execute function set_updated_at();

-- ---------------------------------------------------------------------
-- 4. RLS — everything mirrors folder_permission()
-- ---------------------------------------------------------------------
alter table folder_items            enable row level security;
alter table folder_item_photos      enable row level security;
alter table folder_item_attachments enable row level security;
alter table folder_item_voice_notes enable row level security;
alter table user_favorite_items     enable row level security;

-- Items (view/insert/update; no hard delete — soft delete via archived_at).
create policy items_select on folder_items for select
using (folder_permission(folder_id, 'view'));
create policy items_insert on folder_items for insert
with check (folder_permission(folder_id, 'create'));
create policy items_update on folder_items for update
using (folder_permission(folder_id, 'edit') or folder_permission(folder_id, 'complete'))
with check (folder_permission(folder_id, 'edit') or folder_permission(folder_id, 'complete'));

-- Media: read follows view; write follows create/edit; delete follows edit/create.
create policy photos_select on folder_item_photos for select using (folder_permission(folder_id, 'view'));
create policy photos_insert on folder_item_photos for insert with check (folder_permission(folder_id, 'create') or folder_permission(folder_id, 'edit'));
create policy photos_delete on folder_item_photos for delete using (folder_permission(folder_id, 'edit') or folder_permission(folder_id, 'create'));
create policy photos_update on folder_item_photos for update using (folder_permission(folder_id, 'edit') or folder_permission(folder_id, 'create')) with check (folder_permission(folder_id, 'edit') or folder_permission(folder_id, 'create'));

create policy attach_select on folder_item_attachments for select using (folder_permission(folder_id, 'view'));
create policy attach_insert on folder_item_attachments for insert with check (folder_permission(folder_id, 'create') or folder_permission(folder_id, 'edit'));
create policy attach_delete on folder_item_attachments for delete using (folder_permission(folder_id, 'edit') or folder_permission(folder_id, 'create'));
create policy attach_update on folder_item_attachments for update using (folder_permission(folder_id, 'edit') or folder_permission(folder_id, 'create')) with check (folder_permission(folder_id, 'edit') or folder_permission(folder_id, 'create'));

create policy voice_select on folder_item_voice_notes for select using (folder_permission(folder_id, 'view'));
create policy voice_insert on folder_item_voice_notes for insert with check (folder_permission(folder_id, 'create') or folder_permission(folder_id, 'edit'));
create policy voice_delete on folder_item_voice_notes for delete using (folder_permission(folder_id, 'edit') or folder_permission(folder_id, 'create'));

-- Favorites: a user manages only their own rows, AND only for items whose
-- folder they can currently view. Losing folder access hides the favorite
-- automatically (the select join fails folder_permission).
create policy fav_select on user_favorite_items for select
using (
  user_id = auth.uid()
  and exists (
    select 1 from folder_items i
    where i.id = item_id and folder_permission(i.folder_id, 'view')
  )
);
create policy fav_insert on user_favorite_items for insert
with check (
  user_id = auth.uid()
  and exists (
    select 1 from folder_items i
    where i.id = item_id and folder_permission(i.folder_id, 'view')
  )
);
create policy fav_delete on user_favorite_items for delete
using (user_id = auth.uid());

-- ---------------------------------------------------------------------
-- 5. Secure RPCs
-- ---------------------------------------------------------------------

-- Reorder entries within a folder (manual ordering). Requires edit access.
create or replace function reorder_items(p_folder_id uuid, p_ordered_ids uuid[])
returns void as $$
begin
  if not (folder_permission(p_folder_id, 'edit') or folder_permission(p_folder_id, 'create')) then
    raise exception 'You do not have permission to reorder items in this folder';
  end if;
  update folder_items i
  set position = ord.idx
  from (select id, (ordinality - 1)::int as idx
        from unnest(p_ordered_ids) with ordinality as t(id, ordinality)) ord
  where i.id = ord.id and i.folder_id = p_folder_id;
end;
$$ language plpgsql security definer set search_path = public, pg_temp;

-- Reorder photos within an item. Requires edit/create access to the folder.
create or replace function reorder_photos(p_item_id uuid, p_ordered_ids uuid[])
returns void as $$
declare v_folder uuid;
begin
  select folder_id into v_folder from folder_items where id = p_item_id;
  if v_folder is null then raise exception 'Item not found'; end if;
  if not (folder_permission(v_folder, 'edit') or folder_permission(v_folder, 'create')) then
    raise exception 'You do not have permission to reorder photos';
  end if;
  update folder_item_photos p
  set position = ord.idx
  from (select id, (ordinality - 1)::int as idx
        from unnest(p_ordered_ids) with ordinality as t(id, ordinality)) ord
  where p.id = ord.id and p.item_id = p_item_id;
end;
$$ language plpgsql security definer set search_path = public, pg_temp;

-- Duplicate an entry (text + schedule + pin). Media are NOT copied (they'd
-- need new storage objects); the copy starts with no media. Requires create.
create or replace function duplicate_item(p_item_id uuid)
returns folder_items as $$
declare v_src folder_items; v_new folder_items;
begin
  select * into v_src from folder_items where id = p_item_id;
  if v_src.id is null then raise exception 'Item not found'; end if;
  if not folder_permission(v_src.folder_id, 'view') then
    raise exception 'No access to this item';
  end if;
  if not folder_permission(v_src.folder_id, 'create') then
    raise exception 'You do not have permission to add items to this folder';
  end if;

  insert into folder_items (folder_id, title, body, item_type, scheduled_date, scheduled_time, is_pinned)
  values (
    v_src.folder_id,
    case when v_src.title is not null then left(v_src.title || ' (copy)', 300) else null end,
    v_src.body, v_src.item_type, v_src.scheduled_date, v_src.scheduled_time, false
  )
  returning * into v_new;

  return v_new;
end;
$$ language plpgsql security definer set search_path = public, pg_temp;

-- Return the storage paths of media whose Trash items have expired (>30 days)
-- OR that belong to a specific item being permanently deleted, then hard-delete
-- those items. The client deletes the returned Storage objects afterward.
-- Only workspace admins may purge; folder editors may permanently delete their
-- own folder's trashed items via p_item_id.
create or replace function purge_item(p_item_id uuid)
returns table (bucket text, path text) as $$
declare v_folder uuid;
begin
  select folder_id into v_folder from folder_items where id = p_item_id;
  if v_folder is null then raise exception 'Item not found'; end if;
  if not (folder_permission(v_folder, 'edit') or folder_permission(v_folder, 'create')) then
    raise exception 'You do not have permission to delete this item';
  end if;

  return query
    select 'folder-photos'::text, storage_path from folder_item_photos where item_id = p_item_id
    union all
    select 'folder-attachments'::text, storage_path from folder_item_attachments where item_id = p_item_id
    union all
    select 'folder-voice'::text, storage_path from folder_item_voice_notes where item_id = p_item_id;

  -- child rows cascade on item delete
  delete from folder_items where id = p_item_id;
end;
$$ language plpgsql security definer set search_path = public, pg_temp;

-- Sweep expired Trash (older than 30 days) for a workspace. Admin-only.
-- Returns storage paths for the client to remove from Storage, then deletes rows.
create or replace function purge_expired_trash(p_workspace_id uuid)
returns table (bucket text, path text) as $$
begin
  if not is_workspace_admin(p_workspace_id) then
    raise exception 'Only an administrator may empty expired trash';
  end if;

  return query
    with expired as (
      select id from folder_items
      where workspace_id = p_workspace_id
        and archived_at is not null
        and archived_at < now() - interval '30 days'
    )
    select 'folder-photos'::text, p.storage_path
      from folder_item_photos p join expired e on e.id = p.item_id
    union all
    select 'folder-attachments'::text, a.storage_path
      from folder_item_attachments a join expired e on e.id = a.item_id
    union all
    select 'folder-voice'::text, v.storage_path
      from folder_item_voice_notes v join expired e on e.id = v.item_id;

  delete from folder_items
  where workspace_id = p_workspace_id
    and archived_at is not null
    and archived_at < now() - interval '30 days';
end;
$$ language plpgsql security definer set search_path = public, pg_temp;

-- Empty ALL trash in a single folder now (the "Empty Trash" button). Requires
-- edit/create on that folder. Returns storage paths for client-side removal.
create or replace function empty_folder_trash(p_folder_id uuid)
returns table (bucket text, path text) as $$
begin
  if not (folder_permission(p_folder_id, 'edit') or folder_permission(p_folder_id, 'create')) then
    raise exception 'You do not have permission to empty this folder''s trash';
  end if;

  return query
    with trashed as (
      select id from folder_items
      where folder_id = p_folder_id and archived_at is not null
    )
    select 'folder-photos'::text, p.storage_path
      from folder_item_photos p join trashed t on t.id = p.item_id
    union all
    select 'folder-attachments'::text, a.storage_path
      from folder_item_attachments a join trashed t on t.id = a.item_id
    union all
    select 'folder-voice'::text, v.storage_path
      from folder_item_voice_notes v join trashed t on t.id = v.item_id;

  delete from folder_items
  where folder_id = p_folder_id and archived_at is not null;
end;
$$ language plpgsql security definer set search_path = public, pg_temp;

-- Global search across accessible folders. RLS on folder_items already limits
-- to viewable folders; folder name matches are included via a separate branch.
create or replace function search_items(p_workspace_id uuid, p_query text)
returns table (
  item_id uuid,
  folder_id uuid,
  folder_name text,
  title text,
  body text,
  scheduled_date date,
  is_pinned boolean,
  completed_at timestamptz
) as $$
  select i.id, i.folder_id, f.name, i.title, i.body, i.scheduled_date, i.is_pinned, i.completed_at
  from folder_items i
  join folders f on f.id = i.folder_id
  where i.workspace_id = p_workspace_id
    and i.archived_at is null
    and public.folder_permission(i.folder_id, 'view')
    and (
      i.title ilike '%' || p_query || '%'
      or i.body ilike '%' || p_query || '%'
      or f.name ilike '%' || p_query || '%'
      or exists (
        select 1 from folder_item_attachments a
        where a.item_id = i.id and a.original_filename ilike '%' || p_query || '%'
      )
    )
  order by i.is_pinned desc, i.created_at desc
  limit 100;
$$ language sql security definer stable set search_path = public, pg_temp;

-- ---------------------------------------------------------------------
-- 6. Grants
-- ---------------------------------------------------------------------
revoke execute on function reorder_items(uuid, uuid[]) from public;
revoke execute on function reorder_photos(uuid, uuid[]) from public;
revoke execute on function duplicate_item(uuid) from public;
revoke execute on function purge_item(uuid) from public;
revoke execute on function purge_expired_trash(uuid) from public;
revoke execute on function empty_folder_trash(uuid) from public;
revoke execute on function search_items(uuid, text) from public;

grant execute on function reorder_items(uuid, uuid[]) to authenticated;
grant execute on function reorder_photos(uuid, uuid[]) to authenticated;
grant execute on function duplicate_item(uuid) to authenticated;
grant execute on function purge_item(uuid) to authenticated;
grant execute on function purge_expired_trash(uuid) to authenticated;
grant execute on function empty_folder_trash(uuid) to authenticated;
grant execute on function search_items(uuid, text) to authenticated;

-- ---------------------------------------------------------------------
-- 7. Storage policies (3 private buckets). Path layout for every object:
--    {folder_id}/{item_id}/{uuid}.{ext}
--    First path segment is the folder id, gated by folder_permission().
-- ---------------------------------------------------------------------
create policy "photos read"   on storage.objects for select using (bucket_id = 'folder-photos'      and folder_permission((split_part(name,'/',1))::uuid, 'view'));
create policy "photos write"  on storage.objects for insert with check (bucket_id = 'folder-photos'      and (folder_permission((split_part(name,'/',1))::uuid, 'create') or folder_permission((split_part(name,'/',1))::uuid, 'edit')));
create policy "photos delete" on storage.objects for delete using (bucket_id = 'folder-photos'      and (folder_permission((split_part(name,'/',1))::uuid, 'edit')   or folder_permission((split_part(name,'/',1))::uuid, 'create')));

create policy "attach read"   on storage.objects for select using (bucket_id = 'folder-attachments' and folder_permission((split_part(name,'/',1))::uuid, 'view'));
create policy "attach write"  on storage.objects for insert with check (bucket_id = 'folder-attachments' and (folder_permission((split_part(name,'/',1))::uuid, 'create') or folder_permission((split_part(name,'/',1))::uuid, 'edit')));
create policy "attach delete" on storage.objects for delete using (bucket_id = 'folder-attachments' and (folder_permission((split_part(name,'/',1))::uuid, 'edit')   or folder_permission((split_part(name,'/',1))::uuid, 'create')));

create policy "voice read"    on storage.objects for select using (bucket_id = 'folder-voice'       and folder_permission((split_part(name,'/',1))::uuid, 'view'));
create policy "voice write"   on storage.objects for insert with check (bucket_id = 'folder-voice'       and (folder_permission((split_part(name,'/',1))::uuid, 'create') or folder_permission((split_part(name,'/',1))::uuid, 'edit')));
create policy "voice delete"  on storage.objects for delete using (bucket_id = 'folder-voice'       and (folder_permission((split_part(name,'/',1))::uuid, 'edit')   or folder_permission((split_part(name,'/',1))::uuid, 'create')));

-- =====================================================================
-- End of migration 006_folder_items.sql
-- =====================================================================
