# Task Organizer

A mobile-first, installable task/scheduling PWA for families and small teams, with shared
workspaces, folders, scheduled items, and invitations. This README is written so that you (the
project owner) can pick this project back up months from now without having to reconstruct the
setup from memory.

---

# Project Overview

## What this application does

Task Organizer is a shared task/organizer app with:

- Email/password authentication (Supabase Auth), with auto-created user profiles.
- Workspaces shared between multiple users, with role-based access (owner/admin/member) via
  invitations.
- Folders that hold items (tasks), each with optional photos, attachments, and voice notes.
- Scheduling views: **Today**, **Week**, and a full **Calendar** view.
- Favorites, search, trash (soft delete + empty trash), and a "More" settings/account tab.
- Installable as a PWA (manifest + icons) for a native-app-like mobile experience.

## Main technologies used

| Layer | Technology |
|---|---|
| Framework | [Next.js 14](https://nextjs.org/) (App Router), React 18, TypeScript |
| Styling | Tailwind CSS |
| Backend / DB / Auth | [Supabase](https://supabase.com/) (Postgres, Auth, Storage, Row Level Security) |
| Drag & drop | `@dnd-kit` |
| Icons | `lucide-react` |
| Hosting | [Vercel](https://vercel.com/) (auto-deploys from GitHub) |
| Linting | ESLint (`next/core-web-vitals`) |

## Project architecture

- **Next.js App Router**, split into two route groups:
  - `src/app/(auth)/` — public pages (`/login`, `/signup`).
  - `src/app/(app)/` — the authenticated app shell (`/today`, `/week`, `/folders`, `/calendar`,
    `/favorites`, `/search`, `/users`, `/more`).
- **`src/middleware.ts`** runs on every request: it refreshes the Supabase session cookie and
  redirects unauthenticated users away from protected routes (and authenticated users away from
  `/login` and `/signup`).
- **Data access** goes through three separate Supabase client factories in
  `src/lib/supabase/` — one for the browser, one for Server Components, one for middleware —
  because each runtime handles cookies differently. All three use only the public anon key.
- **Row Level Security (RLS)**, defined in the SQL migrations under `supabase/migrations/`, is
  the actual authorization boundary — not application code. The anon key is safe to expose to the
  browser because Postgres enforces access per-row based on the logged-in user.
- **Server Components fetch data server-side** (e.g. `src/app/(app)/today/page.tsx` queries
  Supabase directly), then pass results down to **Client Components** (marked `"use client"`,
  e.g. `TodayView`) which handle interactivity, local state, and re-fetching.
- **Deployment**: pushing to `main` on GitHub automatically triggers a production build on
  Vercel — there is no separate CI/CD pipeline to maintain.

---

# Local Development

## Prerequisites

- **Node.js** — this project was built and tested with Node **v24.x** and npm **v11.x**. Check
  your version with:
  ```bash
  node -v
  npm -v
  ```
- A **Supabase project** (free tier is fine) with the migrations in `supabase/migrations/`
  already applied (see the [Supabase](#supabase) section below).
- A `.env.local` file with your Supabase credentials (see below) — the app will not start
  correctly without it.

## How to install dependencies

From the project root:

```bash
npm install
```

This reads `package.json` / `package-lock.json` and creates `node_modules/` (which is gitignored
and never committed).

## How to start the development server

```bash
npm run dev
```

This starts Next.js in development mode (hot reload) at **http://localhost:3000**. The terminal
output will confirm it loaded `.env.local`:

```
- Local:        http://localhost:3000
- Environments: .env.local
```

## How to stop it

Press **Ctrl+C** in the terminal running `npm run dev`. If you started it in the background and
lost the terminal, find and stop the process with:

```bash
lsof -i :3000        # find the PID listening on port 3000
kill <PID>
```

---

# Git Workflow

## How to check status

```bash
git status
```

Shows staged/unstaged/untracked files. Always run this before committing to make sure you're not
accidentally including something you don't want (e.g. a stray `.env.local`).

## How to create commits

```bash
git add <specific files>       # avoid `git add -A` / `git add .` — review what you're staging
git commit -m "Short summary of the change"
```

For anything non-trivial, prefer a multi-line message with a body explaining **why**:

```bash
git commit -m "$(cat <<'EOF'
Short summary line (imperative mood, under ~70 chars)

Longer explanation of why this change was needed, what problem it
solves, and anything non-obvious about the approach.
EOF
)"
```

## How to push changes

```bash
git push origin main
```

Pushing to `main` triggers an automatic Vercel production deployment (see
[Vercel Deployment](#vercel-deployment)).

## How to pull updates

```bash
git pull origin main
```

Do this before starting new work if there's any chance the remote has changed (e.g. you edited
something directly on GitHub, or from another machine).

## Recommended commit message style

- **Summary line**: imperative mood ("Fix", "Add", "Update" — not "Fixed"/"Adds"), concise,
  describes *what* changed.
- **Body** (optional but encouraged for non-trivial changes): explain *why*, not what — the diff
  already shows what changed. Mention root causes for bug fixes.
- One logical change per commit. Don't bundle unrelated fixes together.
- Avoid vague messages like "update" or "fix stuff".

---

# GitHub

- **Repository name:** [`lisavetaH/task-organizer`](https://github.com/lisavetaH/task-organizer)
  (public repo).
- **Default branch:** `main`.
- **How it's connected to Vercel:** the **Vercel GitHub App** is installed on this repository
  (visible as the `vercel[bot]` account, which is what creates GitHub "Deployment" entries and
  posts the "Vercel — Deployment has completed" status check on each commit). No manual webhook
  configuration is needed or present — the GitHub App integration handles everything. You can see
  connected repos/apps under GitHub → Settings → Applications → Installed GitHub Apps, or from
  the Vercel dashboard → Project → Settings → Git.

---

# Vercel Deployment

- **Project name:** `task-organizer`
- **Team:** `lisavetagalenko1234-4629's projects`
- **Production domains:**
  - `task-organizer-ten.vercel.app`
  - `task-organizer-lisavetagalenko1234-4629s-projects.vercel.app`
  - `task-organizer-git-main-lisavetagalenko1234-4629s-projects.vercel.app`

## How automatic deployment works

Every `git push` to `main` triggers a new **production** build on Vercel automatically (no manual
"deploy" step needed). Vercel:

1. Pulls the exact commit from GitHub.
2. Runs `npm install` and `npm run build`.
3. If the build succeeds, creates a new deployment with its own permanent, unique URL.
4. Points the shared production domains (listed above) at this newest deployment.

## How to verify that a deployment succeeded

1. Go to the [Vercel dashboard](https://vercel.com/) → the `task-organizer` project → **Deployments**.
2. The newest entry should show status **Ready** (not "Error" or "Building") and be marked
   **Production**.
3. Confirm the commit hash/message shown matches what you just pushed
   (`git log -1 --oneline` locally).
4. Open the production URL and hard-refresh (see [Troubleshooting](#troubleshooting)) to confirm
   the change is actually visible.
5. Alternatively, on GitHub, the commit will show a green check with a "Vercel" status linking
   directly to that deployment.

## Difference between Production URL and old deployment URLs

**This is the single most common source of confusion on this project — read carefully.**

- The three domains listed above ("production domains") always point to the **most recent**
  production deployment. They move forward automatically every time you push to `main`.
- **Every individual deployment also gets its own unique, permanent URL**
  (e.g. `task-organizer-lkmsfb7zj-lisavetagalenko1234-4629s-projects.vercel.app`). This URL is
  frozen forever at the exact commit it was built from — it does **not** update when you push new
  code, even though Vercel still labels it "Production" in the deployments list.
- If you (or someone you shared a link with) bookmarked one of these deployment-specific URLs
  instead of the shared production domain, you will keep seeing old, outdated behavior
  indefinitely — no amount of pushing new code will change what that specific URL shows.
- **Rule of thumb:** always test against `task-organizer-ten.vercel.app` (or one of the other two
  shared production domains), never against a `task-organizer-<random-id>-...vercel.app` URL you
  found in an old browser tab, old chat message, or old bookmark.

## Common deployment mistakes

- **Testing an old deployment URL** instead of the shared production domain (see above).
- **Browser cache** showing a stale page after a real, successful deploy — always hard-refresh or
  test in a private/incognito window before concluding a deploy "didn't work".
- **Missing/incorrect environment variables** on Vercel — env vars in `.env.local` are **not**
  automatically synced to Vercel; they must be added separately in the Vercel dashboard (see
  below). A missing `NEXT_PUBLIC_SUPABASE_URL`/`NEXT_PUBLIC_SUPABASE_ANON_KEY` on Vercel causes a
  "Supabase URL and Key are required" error in production even though local dev works fine.
- **Committing `.env.local` by accident** — it's gitignored on purpose; never force-add it.
- **Assuming a push instantly updates production** — builds take roughly 30–90 seconds; check the
  dashboard before assuming something is broken.

---

# Supabase

## What environment variables are required

| Variable | Required | Public/Secret | Purpose |
|---|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | Yes | Public | Your Supabase project URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Yes | Public | Anon/public API key, safe for browser use |
| `APP_URL` | Yes (production) | Server-only, not sensitive | Base URL used to build invite links. Never derived from request headers — set explicitly per environment so links always point at the real app. Unset in local dev, where it falls back to `http://localhost:3000` |
| `RESEND_API_KEY` | Yes (for invitations) | **Secret** | Sends invitation emails via Resend. Without it, pressing Invite fails with a clear error — there is no manual-link fallback |
| `INVITE_EMAIL_FROM` | Yes (for invitations) | Secret | "From" address for invitation emails. `onboarding@resend.dev` (Resend's shared test domain) only delivers to the email on your own Resend account — switch to a verified domain before inviting real users |

## Where they are configured

- **Local development:** copy `.env.local.example` → `.env.local` and fill in real values from
  **Supabase Dashboard → Project Settings → API**. `.env.local` is listed in `.gitignore` and is
  never committed.
- **Production (Vercel):** set the same variables independently in
  **Vercel Dashboard → Project → Settings → Environment Variables**. This is a manual, one-time
  step per variable — Vercel does not read your local `.env.local` file.

## Which keys are public and which must remain secret

- `NEXT_PUBLIC_*` variables are bundled into client-side JavaScript and are visible to anyone
  using the app — this is expected and safe **only** for the anon key, because Postgres Row Level
  Security enforces real access control server-side.
- **Never** add the Supabase **service_role** key to this project, in any environment file, on
  Vercel, or anywhere else. It bypasses Row Level Security entirely. This project is designed to
  work without it.
- `RESEND_API_KEY` and `INVITE_EMAIL_FROM` must **not** have the `NEXT_PUBLIC_` prefix and must
  only ever be set as server-side environment variables (local `.env.local` or Vercel's
  environment variables panel) — never hardcoded, never exposed to the browser.

## Database connection overview

- The app never talks to Postgres directly — all access goes through
  `@supabase/supabase-js` / `@supabase/ssr`, using the anon key over HTTPS.
- Three separate client factories exist because cookie handling differs by runtime:
  - `src/lib/supabase/client.ts` — browser client (Client Components).
  - `src/lib/supabase/server.ts` — server client for Server Components/Actions, reads cookies via
    `next/headers`.
  - `src/lib/supabase/middleware.ts` — used by `src/middleware.ts` to refresh the session cookie
    on every request and gate protected routes.
- Schema and security policies live in `supabase/migrations/`, applied **manually** through the
  Supabase SQL editor (there is no `supabase/config.toml` — this project does not use the
  Supabase CLI's migration workflow):
  1. `001_initial_schema.sql` — the core schema (locked baseline, referred to as "v4.1").
  2. `002_folder_management.sql`
  3. `003_folder_metadata_visibility.sql`
  4. `004_folder_access_modes.sql`
  5. `005_invitation_flow.sql`
  6. `006_folder_items.sql`

  Run them **in order, in full**, in the SQL editor when setting up a new Supabase project.
- Access control is enforced by **Row Level Security** policies defined in these migrations —
  not by application-level checks. Every table a user can reach has RLS policies scoping rows to
  their workspace/role.

---

# Project Structure

```
src/
├── app/                      # Next.js App Router — routes and layouts
│   ├── (auth)/                #   Public routes: /login, /signup
│   ├── (app)/                 #   Authenticated app shell: /today, /week, /folders,
│   │                          #   /calendar, /favorites, /search, /users, /more
│   ├── invite/[token]/        #   Public invitation-acceptance page
│   ├── layout.tsx             #   Root HTML layout (PWA meta tags, fonts)
│   ├── page.tsx                #   Root route — redirects based on auth state
│   └── globals.css            #   Tailwind base styles
├── components/                # React components, grouped by feature
│   ├── folders/                #   Folder list/management UI
│   ├── items/                  #   Item cards, editor, photos, attachments, voice notes, trash
│   ├── schedule/                #   Today/Week/Calendar views
│   ├── search/                  #   Search UI
│   ├── users/                    #   Access/invitations management UI
│   ├── invite/                    #   Invite-acceptance flow UI
│   └── *.tsx                       #   Shared UI (BottomNav, LoadingState, ErrorState)
├── lib/                        # Non-UI logic — data access, helpers, types
│   ├── supabase/                #   The three Supabase client factories (see above)
│   ├── dates.ts                  #   Locale-pinned date/time formatting helpers
│   ├── items.ts, folders.ts,      #   Supabase queries/mutations per domain area
│   │   schedule.ts, invitations.ts,
│   │   invitations-actions.ts,
│   │   auth-actions.ts, access.ts,
│   │   share.ts, email.ts, folder-icons.ts
│   └── types.ts                  #   Shared TypeScript types
└── middleware.ts               # Session refresh + auth route protection (runs on every request)

supabase/
└── migrations/                # SQL schema, applied manually via the Supabase SQL editor

public/
├── manifest.json               # PWA manifest (name, icons, theme color)
└── icons/                      # PWA icons (192px, 512px, Apple touch icon)
```

Other root files: `next.config.mjs` (Next.js config), `tailwind.config.ts` /
`postcss.config.mjs` (styling), `tsconfig.json` (TypeScript, path alias `@/*` → `src/*`),
`.eslintrc.json` (lint rules), `.env.example` / `.env.local.example` (env var templates —
templates only, never real secrets).

---

# Common Commands

| Command | What it does |
|---|---|
| `npm install` | Install/update dependencies into `node_modules/` |
| `npm run dev` | Start the local dev server at http://localhost:3000 with hot reload |
| `npm run build` | Production build (also type-checks and lints) — run this before pushing significant changes |
| `npm run start` | Run the production build locally (must run `npm run build` first) |
| `npm run lint` | Run ESLint |
| `npx tsc --noEmit` | Run the TypeScript compiler in check-only mode (no output files) |
| `git status` | See what's changed/staged |
| `git add <files>` | Stage specific files |
| `git commit -m "..."` | Commit staged changes |
| `git push origin main` | Push to GitHub and trigger a Vercel deploy |
| `git pull origin main` | Pull the latest from GitHub |
| `git log --oneline -10` | See the last 10 commits |
| `lsof -i :3000` | Find what process is using port 3000 |

---

# Troubleshooting

## Hydration mismatch ("Text content did not match. Server: ... Client: ...")

**Cause:** any value that can differ between server-render and browser-render — most commonly
`Date.prototype.toLocaleDateString(undefined, …)` / `toLocaleTimeString(undefined, …)`. Passing
`undefined` as the locale resolves to the **server's** locale during server-side rendering, but to
the **browser's** `navigator.language` during client-side hydration. If they differ (e.g. server
locale is English, visitor's browser is set to Russian), React sees two different strings for the
same render and throws a hydration warning — the visible symptom is the date briefly (or
permanently, if it recurs) showing in the wrong language.

**Fix already applied:** `src/lib/dates.ts` pins a `DISPLAY_LOCALE = "en-US"` constant and passes
it explicitly to every `toLocaleDateString`/`toLocaleTimeString` call, instead of `undefined`.
This guarantees identical output on server and client regardless of the visitor's browser
settings. If you see this warning again, check whether a *new* date-formatting call somewhere
else in the codebase uses `undefined`/no locale argument instead of importing the existing
helpers from `src/lib/dates.ts`.

## Wrong Vercel deployment URL

If production "still shows the old version" after a successful deploy, the most common cause is
testing against an old deployment-specific URL (e.g.
`task-organizer-<random-id>-lisavetagalenko1234-4629s-projects.vercel.app`) instead of the shared
production domain (`task-organizer-ten.vercel.app`). Deployment-specific URLs are frozen forever
at whatever commit built them — see [Difference between Production URL and old deployment
URLs](#difference-between-production-url-and-old-deployment-urls) above. Always verify by opening
the shared production domain directly, and cross-check the commit shown in the Vercel dashboard.

## Environment variables

- **Local:** if you get a "Supabase URL and Key are required" error locally, check that
  `.env.local` exists in the project root (not just `.env.local.example`) and contains real
  values, then restart `npm run dev` — Next.js only reads env files at server start.
- **Production:** the same error on the deployed site almost always means the environment
  variables weren't added in Vercel's dashboard (they don't come from your local `.env.local`
  automatically). Add them under Project → Settings → Environment Variables, then redeploy.

## GitHub push succeeded but production isn't updating

1. Check the Vercel dashboard's **Deployments** tab — is a new deployment even listed for your
   latest commit? If not, the GitHub App connection may have an issue (check
   GitHub → Settings → Applications → Installed GitHub Apps → Vercel, and Vercel → Project →
   Settings → Git).
2. If a deployment is listed but shows **Error**, open it and check the build logs.
3. If it shows **Ready**, you're very likely looking at a stale browser cache or an old
   deployment-specific URL — see the two sections above.

## Browser cache

After confirming a deployment is genuinely **Ready** on Vercel, always verify with:
- A hard refresh (Cmd+Shift+R on Mac), or
- A private/incognito window, or
- `curl -I <url>` to inspect response headers directly, bypassing the browser entirely.

This rules out the browser simply reusing a previously cached page/response.

## Login issues

- **Signup works but login says invalid credentials / stuck on "confirm your email":** in
  Supabase Dashboard → Authentication → Providers → Email, the "Confirm email" toggle may be on.
  For local testing convenience it's common to disable it; re-enable it before treating this as a
  production-ready app.
- **Logged in but immediately redirected back to `/login`:** check that `src/middleware.ts` is
  actually running (matcher config) and that cookies are being set — this usually means the
  Supabase env vars are wrong/missing (session refresh silently fails).
- **`profiles` row missing after signup:** check that migration `001_initial_schema.sql` was run
  in full — it defines the `handle_new_user` trigger that auto-creates a profile row.

## Invitation email fails to send

- **"Email delivery is not configured" error:** `RESEND_API_KEY` and/or `INVITE_EMAIL_FROM` are
  missing from the environment (local `.env.local` or, in production, Vercel's Environment
  Variables panel). There is no manual-link fallback — fix the env vars and try again.
- **Error mentions the domain isn't verified, or the email silently never arrives while using
  `onboarding@resend.dev`:** Resend's shared test domain only delivers to the email address on
  your own Resend account. To invite anyone else, verify a real domain in the Resend dashboard
  and point `INVITE_EMAIL_FROM` at an address on it (e.g. `invites@yourdomain.com`).
- **Works locally but fails in production (or vice versa):** `RESEND_API_KEY` /
  `INVITE_EMAIL_FROM` are set independently per environment, same as the Supabase keys — check
  both `.env.local` and the Vercel dashboard.

## Invitation link points to localhost (or the wrong host) in a received email

**Cause:** `src/lib/invitations-actions.ts`'s `siteOrigin()` used to fall back to deriving the
link from the incoming request's `host`/`x-forwarded-host` headers whenever `APP_URL` (formerly
`NEXT_PUBLIC_SITE_URL`) wasn't set. If an invite was ever sent while the app was reached via
`localhost:3000` (e.g. `npm run dev`), that host got baked into the emailed link — useless on
another device, and on a Mac running the same dev server it silently opened the local app instead
of production.

**Fix already applied:** `siteOrigin()` no longer reads request headers at all. It only reads
`APP_URL`, falling back to a hardcoded `http://localhost:3000` when unset. Set `APP_URL` in every
environment where invitations should carry a real, working link — for this project, Vercel
Production has `APP_URL=https://taskorganizer.app`. If a future invite email still shows the
wrong host, check that `APP_URL` is set in the environment that actually sent it, not just that
the code deployed.

---

# Development Rules

The agreed workflow for making changes to this project:

1. **Make code changes** — small, focused changes over large sweeping ones.
2. **Test locally** — run `npm run dev`, exercise the changed feature in the browser, and run
   `npm run lint` / `npx tsc --noEmit` / `npm run build` to catch errors before committing.
3. **Commit** — stage only the relevant files, write a clear commit message explaining *why*.
4. **Push** — `git push origin main`.
5. **Wait for Vercel deployment** — check the dashboard until the new deployment shows **Ready**
   (usually well under 2 minutes).
6. **Verify production** — open the shared production domain (not a deployment-specific URL),
   hard-refresh, and confirm the change actually looks right live, not just locally.

---

# Future Improvements

- [ ] Add automated tests (unit tests for `src/lib/`, integration/E2E for critical flows like
      signup → create folder → schedule item).
- [ ] Add CI checks (lint + typecheck + build) on pull requests, before merging to `main`, rather
      than relying on Vercel's build as the only gate.
- [ ] Move Supabase migrations to the Supabase CLI's managed migration workflow
      (`supabase/config.toml` + `supabase db push`) instead of manual SQL-editor execution.
- [ ] Add a staging/preview environment workflow (Vercel Preview Deployments + a separate Supabase
      project) so schema changes can be tested before touching production data.
- [ ] Audit and upgrade dependencies (Next.js 14 → latest, and address the `npm audit`
      vulnerabilities flagged at install time).
- [ ] Add real-time updates (Supabase Realtime) so shared workspace changes appear live for other
      members without a manual refresh.
- [ ] Add offline support via a service worker (the PWA manifest exists, but there's no
      service-worker-based offline caching yet).
- [ ] Add proper error/loading states audit across all routes for consistency.
