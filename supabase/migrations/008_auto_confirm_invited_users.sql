-- =====================================================================
-- 008_auto_confirm_invited_users.sql
-- Depends on 001-007. Nothing in 001-007 is modified.
--
-- Problem: with Supabase's "Confirm email" setting enabled, a brand-new
-- user who signs up to accept a workspace invitation is left in an
-- unconfirmed state and cannot log in ("Email not confirmed") until they
-- click a separate Supabase confirmation email — even though the
-- invitation token itself (a secure, admin-issued, single-use value sent
-- to that exact address, independently re-verified by accept_invitation)
-- already establishes that this email is legitimate and expected.
--
-- Fix: auto-confirm the email on signup ONLY when it matches a currently
-- pending, non-expired invitation. This does NOT change the project-wide
-- "Confirm email" setting — anyone signing up without a matching pending
-- invitation still goes through normal confirmation, unchanged.
-- =====================================================================

create or replace function auto_confirm_invited_users() returns trigger as $$
begin
  if exists (
    select 1 from public.invitations
    where lower(trim(email)) = lower(trim(new.email))
      and status = 'pending'
      and expires_at > now()
  ) then
    update auth.users
    set email_confirmed_at = coalesce(email_confirmed_at, now())
    where id = new.id;
  end if;
  return new;
end;
$$ language plpgsql security definer set search_path = public, pg_temp;

create trigger trg_auto_confirm_invited_users
after insert on auth.users
for each row execute function auto_confirm_invited_users();

-- Supabase grants EXECUTE to `anon` by default on newly created functions
-- (see the project's own security audit notes). This function can never be
-- invoked directly anyway (return type `trigger` cannot be called outside
-- trigger context), but revoke it explicitly for consistency.
revoke execute on function auto_confirm_invited_users() from anon;

-- =====================================================================
-- End of migration 008_auto_confirm_invited_users.sql
-- =====================================================================
