-- =====================================================================
-- 002_folder_management.sql
-- Phase 2 additive migration. Depends on 001_initial_schema.sql.
--
-- Adds an atomic, admin-checked RPC to persist folder ordering (drag &
-- drop). Folder create/rename/archive/color/icon all go through the
-- existing RLS policies from 001 (folders_admin_insert / folders_admin_update)
-- and need no new SQL. Only multi-row reordering benefits from an RPC so the
-- new positions commit atomically.
-- =====================================================================

create or replace function reorder_folders(
  p_workspace_id uuid,
  p_ordered_ids uuid[]
) returns void as $$
begin
  if auth.uid() is null then
    raise exception 'Authentication required';
  end if;
  if not is_workspace_admin(p_workspace_id) then
    raise exception 'Only an administrator may reorder folders';
  end if;

  -- Assign position by array order (0-based). Any id that does not belong to
  -- this workspace is ignored by the workspace_id guard in the WHERE clause.
  update folders f
  set position = ord.idx
  from (
    select id, (ordinality - 1)::int as idx
    from unnest(p_ordered_ids) with ordinality as t(id, ordinality)
  ) ord
  where f.id = ord.id
    and f.workspace_id = p_workspace_id;
end;
$$ language plpgsql security definer set search_path = public, pg_temp;

revoke execute on function reorder_folders(uuid, uuid[]) from public;
grant execute on function reorder_folders(uuid, uuid[]) to authenticated;

-- =====================================================================
-- End of migration 002_folder_management.sql
-- =====================================================================
