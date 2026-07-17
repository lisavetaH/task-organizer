-- =====================================================================
-- 005_invitation_flow.sql
-- Phase 2 — invitation flow. Depends on 001–004.
--
-- SUPABASE FIX (v2): pgcrypto lives in the `extensions` schema on Supabase,
-- but these SECURITY DEFINER functions pin `search_path = public, pg_temp`,
-- which excludes it. So digest() / gen_random_bytes() could not be resolved
-- (ERROR 42883). Every pgcrypto call below is now schema-qualified as
-- extensions.digest(...) / extensions.gen_random_bytes(...), which resolves
-- regardless of search_path at both creation and runtime.
--
-- This file also RE-DEFINES create_invitation and accept_invitation (which
-- originate in 001) with the same qualification. This does NOT modify the
-- 001 file — it is an idempotent `create or replace` in a later migration —
-- and is necessary because those two functions call the same pgcrypto
-- functions and would otherwise fail at runtime when inviting/accepting.
--
-- The core invitation machinery (table, unique index, revoke_invitation,
-- admin select policy) is unchanged from 001.
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1. create_invitation — re-defined with extensions-qualified pgcrypto.
--    Body identical to 001 except gen_random_bytes/digest are qualified.
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
  if p_role not in ('admin','worker') then
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

-- ---------------------------------------------------------------------
-- 2. accept_invitation — re-defined with extensions-qualified pgcrypto.
--    Body identical to 001 except digest is qualified.
-- ---------------------------------------------------------------------
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
-- 3. Resend: regenerate the token and extend expiry on an existing
--    pending/expired invitation (same row — avoids the pending-unique
--    conflict a fresh insert would hit). Admin-only. Returns the new token.
-- ---------------------------------------------------------------------
create or replace function resend_invitation(p_invitation_id uuid)
returns text as $$
declare
  v_workspace_id uuid;
  v_status text;
  v_token text;
begin
  select workspace_id, status into v_workspace_id, v_status
  from invitations where id = p_invitation_id;

  if v_workspace_id is null then
    raise exception 'Invitation not found';
  end if;
  if not is_workspace_admin(v_workspace_id) then
    raise exception 'Only an administrator may resend invitations';
  end if;
  if v_status not in ('pending', 'expired') then
    raise exception 'Only pending or expired invitations can be resent';
  end if;

  v_token := encode(extensions.gen_random_bytes(32), 'hex');

  update invitations
  set token_hash = encode(extensions.digest(v_token, 'sha256'), 'hex'),
      status = 'pending',
      expires_at = now() + interval '7 days',
      accepted_at = null
  where id = p_invitation_id;

  return v_token;
end;
$$ language plpgsql security definer set search_path = public, pg_temp;

-- ---------------------------------------------------------------------
-- 4. Invitation preview: minimal, tokened lookup for the invitee (possibly
--    logged out). Possession of the 32-byte token is the authorization.
--    Returns 0 rows for an unknown token. Exposes no folder/task/member data.
-- ---------------------------------------------------------------------
create or replace function get_invitation_preview(p_token text)
returns table (
  workspace_name text,
  email text,
  status text,
  is_expired boolean
) as $$
  select
    w.name,
    i.email,
    i.status,
    (i.status = 'expired' or i.expires_at <= now()) as is_expired
  from invitations i
  join workspaces w on w.id = i.workspace_id
  where i.token_hash = encode(extensions.digest(p_token, 'sha256'), 'hex');
$$ language sql security definer stable set search_path = public, pg_temp;

-- ---------------------------------------------------------------------
-- 5. Grants (create or replace preserves existing grants; re-granting here
--    is idempotent and keeps this migration self-contained).
-- ---------------------------------------------------------------------
grant execute on function create_invitation(uuid, text, text) to authenticated;
grant execute on function accept_invitation(text) to authenticated;

revoke execute on function resend_invitation(uuid) from public;
grant execute on function resend_invitation(uuid) to authenticated;

revoke execute on function get_invitation_preview(text) from public;
-- anon may preview (invitee not yet signed in); authenticated may too.
grant execute on function get_invitation_preview(text) to anon, authenticated;

-- =====================================================================
-- End of migration 005_invitation_flow.sql
-- =====================================================================
