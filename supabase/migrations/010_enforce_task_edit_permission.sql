-- Column-level enforcement for folder_items updates.
--
-- items_update's RLS policy (folders_items policy "items_update") allows the
-- row to be touched by anyone with EITHER 'edit' OR 'complete' folder
-- permission -- necessary so a complete-only member (Selected access,
-- can_edit_tasks = false) can toggle completed_at at all. But a row-level
-- RLS policy can't distinguish which columns are being changed, so as
-- written a complete-only member could PATCH title/body/schedule/etc on any
-- task in their folder too -- confirmed live against production during this
-- milestone's verification pass (a verify-member-selected@test.local test
-- account, granted only can_complete_tasks, successfully rewrote a task's
-- title via a direct REST call). That violates "enforce permissions in the
-- database, not just hidden UI buttons."
--
-- protect_item_update() already runs on every update and already has
-- special-cased, from-scratch handling for completed_at/completed_by (it
-- ignores whatever the client sends for completed_by and derives it from
-- auth.uid() itself), so it's the natural place to add the missing column
-- split: any change to a column other than completion state now requires
-- 'edit' permission (which admins/owners always have via
-- folder_permission()'s is_folder_admin short-circuit).
create or replace function public.protect_item_update()
returns trigger
language plpgsql
security definer
set search_path = 'public', 'pg_temp'
as $$
begin
  if (new.title, new.body, new.item_type, new.scheduled_date, new.scheduled_time,
      new.is_pinned, new.position, new.archived_at)
     is distinct from
     (old.title, old.body, old.item_type, old.scheduled_date, old.scheduled_time,
      old.is_pinned, old.position, old.archived_at)
     and not public.folder_permission(old.folder_id, 'edit')
  then
    raise exception 'insufficient permission to edit this task';
  end if;

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
$$;

revoke execute on function public.protect_item_update() from anon;
