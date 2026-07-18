# Instructions for Claude

## Keep README.md in sync

Whenever a change in this repo affects any of the following, update `README.md` in the same
piece of work (don't leave it for later):

- **Project architecture** — new major folders, new route groups, new data-flow patterns, new
  Supabase client/entry points, new significant dependencies.
- **Local setup** — new prerequisites, new environment variables, new install/build steps.
- **Deployment process** — changes to how Vercel builds/deploys this project, new production
  domains, changes to the GitHub↔Vercel connection.
- **Workflows** — changes to the git/commit/push/verify workflow described in README's
  "Development Rules" section, or new recurring troubleshooting scenarios worth documenting.

Update the relevant README section(s) directly — don't just append notes at the bottom. If a
troubleshooting scenario comes up that isn't already documented, add it to the Troubleshooting
section with root cause and fix, the same way the hydration-mismatch and wrong-deployment-URL
entries are written.
