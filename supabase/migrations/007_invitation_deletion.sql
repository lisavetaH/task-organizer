-- =====================================================================
-- 007_invitation_deletion.sql
-- Depends on 001-006. Nothing in 001-006 is modified.
--
-- Adds a hard-delete RPC for invitations. Previously the only lifecycle
-- transition available was revoke_invitation (status -> 'revoked'), which
-- leaves the row (and it) visible in the Users & access UI forever. This
-- lets an admin actually remove a cancelled/expired/pending invitation row.
--
-- No change to accept_invitation, create_invitation, the token system, or
-- the invitations_pending_unique partial index (unaffected by this file —
-- a plain delete just removes a row, it doesn't need special-casing there).
-- =====================================================================

create or replace function delete_invitation(p_invitation_id uuid) returns void as $$
declare
  v_workspace_id uuid;
begin
  select workspace_id into v_workspace_id from invitations where id = p_invitation_id;
  if v_workspace_id is null then
    raise exception 'Invitation not found';
  end if;
  if not is_workspace_admin(v_workspace_id) then
    raise exception 'Only an administrator may delete an invitation';
  end if;

  delete from invitations where id = p_invitation_id;
end;
$$ language plpgsql security definer set search_path = public, pg_temp;

revoke execute on function delete_invitation(uuid) from public;
-- Supabase grants EXECUTE to `anon` by default on newly created functions,
-- independent of the `revoke ... from public` above (see the project's own
-- security audit notes) — revoke it explicitly so only authenticated callers
-- can ever reach this function.
revoke execute on function delete_invitation(uuid) from anon;
grant execute on function delete_invitation(uuid) to authenticated;

-- =====================================================================
-- End of migration 007_invitation_deletion.sql
-- =====================================================================
