-- =====================================================================
-- 012_edge_function_account_deletion.sql
--
-- Replaces migration 011's delete_own_account() (which deleted the
-- auth.users row directly from a SECURITY DEFINER SQL function) with the
-- Supabase-recommended architecture: the auth.admin.deleteUser() Admin API,
-- called from a new Edge Function (supabase/functions/delete-account),
-- using the service-role key that Supabase auto-injects into every Edge
-- Function's runtime -- it never touches this repo, Vercel, or any value
-- an operator has to handle by hand.
--
-- Why: the previous approach relied on the `postgres` role's grant on
-- auth.users, which is an implementation detail Supabase does not document
-- or promise to preserve -- and it bypassed GoTrue's own audit logging
-- (auth.audit_log_entries never saw the deletion). The Admin API is a
-- versioned public interface with both of those guarantees.
--
-- What stays exactly the same: the owner-block check and invitation
-- cleanup remain a SECURITY DEFINER Postgres function, run inside the
-- Edge Function using the CALLER's own JWT (not the service-role client),
-- so RLS and auth.uid() behave identically to before. The service-role
-- client is used for exactly one call -- auth.admin.deleteUser() -- and
-- only after this function has already authorized the deletion. Owner
-- protection is therefore still enforced entirely at the database layer.
-- =====================================================================

drop function if exists public.delete_own_account();

create or replace function public.prepare_own_account_deletion()
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
end;
$$;

revoke execute on function public.prepare_own_account_deletion() from public;
revoke execute on function public.prepare_own_account_deletion() from anon;
grant execute on function public.prepare_own_account_deletion() to authenticated;

-- =====================================================================
-- End of migration 012_edge_function_account_deletion.sql
-- =====================================================================
