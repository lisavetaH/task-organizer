# Task Organizer — Phase 1

Mobile-first, installable PWA shell with Supabase authentication.
Database architecture is locked at **v4.1** (`supabase/migrations/001_initial_schema.sql`).

Phase 1 includes only: Next.js + TypeScript + Tailwind setup, Supabase SSR,
authentication (signup / login / logout / session persistence), the five-tab
app shell (Today / Week / Folders / Calendar / More), and PWA configuration.
No tasks, folders, permissions, comments, invitations, calendar logic,
realtime, or deployment yet.

## Setup

```bash
npm install
```

1. Create a Supabase project.
2. In the Supabase SQL editor (service role), run
   `supabase/migrations/001_initial_schema.sql` in full.
3. Copy `.env.local.example` to `.env.local` and fill in:
   - `NEXT_PUBLIC_SUPABASE_URL`
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   (Project Settings → API. Never add the service_role key.)
4. For fast local testing, turn **off** email confirmation:
   Authentication → Providers → Email → disable "Confirm email".

```bash
npm run dev
```

Visit http://localhost:3000.

## Testing the auth flow

- Unauthenticated visit to `/` or `/today` → redirected to `/login`.
- `/signup` with name + email + password → lands on `/today`.
- Supabase → Table Editor → `profiles` shows an auto-created row (proves the
  `handle_new_user` trigger fired).
- **More** tab → **Log out** → back to `/login`; protected routes now redirect.
- Log in again, refresh → session persists.

## Security notes

- Only the public anon key is used client-side. The service-role key is not
  present in this project.
- `.env.local` is gitignored and never committed.
- All data access is governed by Row Level Security defined in the migration.
