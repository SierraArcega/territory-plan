# How Sierra + Claude Code Together

This document defines how Sierra and Claude collaborate on coding projects. It should be referenced at the start of any coding session.

---

## Writing Conventions

- Always use "Sierra" (or "the human") and "Claude" instead of pronouns
- Never use "I", "you", "me", "my", "your" in CLAUDE.md files
- This avoids ambiguity about who "I" or "you" refers to
- Example: "Sierra writes, Claude edits" (not "I write, you edit")

---

## Planning Protocol

### Design Doc → Implementation Plan → Execute

Every feature follows this three-step workflow:

1. **Design doc** — Sierra and Claude discuss the feature, then Claude writes a design doc (`Docs/plans/YYYY-MM-DD-feature-name-design.md`) covering:
   - **Goal** — one sentence describing the outcome
   - **Architecture** — key components, state changes, data flow
   - **UI/Layout** — dimensions, positioning, visual style
   - **Interactions** — user behaviors, edge cases
   - **Out of scope** — explicit boundaries to prevent creep

2. **Implementation plan** — After Sierra approves the design, Claude writes a task-by-task implementation plan (`Docs/plans/YYYY-MM-DD-feature-name-implementation.md`) with:
   - Numbered tasks in dependency order
   - Exact files to create or modify per task
   - Code snippets showing the approach
   - One commit per task

3. **Execute task-by-task** — Claude implements the plan one task at a time, committing after each task, with check-ins between phases

### Clarifying Questions

- Ask clarifying questions **one at a time** so Sierra can give complete answers
- Get approval on the design doc before writing the implementation plan
- Get approval on the implementation plan before writing code

### Check Understanding

- After completing each task, ask if Sierra has questions about what was just done
- Sierra wants to understand all changes — don't just produce code, teach the "why"
- This supports Sierra's goal of learning the coding ecosystem and process

---

## Code Style Preferences

### Comments and Explanation

- **Explain code well using natural language comments**
- Walk through the logic as code is being written
- Help Sierra learn alongside Claude—don't just produce code, teach the "why"
- Use common language, avoid jargon without explanation

### File Organization

- Organize by **feature directory** — related components live together (e.g., `map-v2/`, `panels/district/`, `plans/`)
- Shared utilities go in `lib/` as single-purpose files (e.g., `map-v2-ref.ts`, `store.ts`)
- Don't split prematurely — keep related functionality together until complexity demands separation
- Avoid deep nesting; flat feature directories are preferred

### Error Handling

- Use **balanced defensive coding**
- Include try/catch blocks where failures are likely or consequential
- Don't over-engineer error handling at the expense of moving forward
- Write clear, actionable error messages

---

## Git Workflow

### Starting a Session

When beginning any coding work together:

1. **Create a feature branch immediately** before making any changes
   ```bash
   git checkout main
   git pull origin main
   git checkout -b feature/descriptive-name
   ```
2. **Start committing early** — don't wait until the feature is "done"
3. **Push the branch to GitHub** after the first meaningful commit

This ensures work is never at risk of being lost and can be easily rolled back.

### Branching Strategy

- **Always use branches** for new features and large updates
- Never commit directly to main for significant changes
- Use descriptive branch names: `feature/add-user-dashboard`, `fix/login-redirect`

### Commit Philosophy

- Make **regular, small commits** that can be rolled back easily
- Avoid large commits that bundle many changes together
- If something breaks, Sierra shouldn't lose a lot of work

### Commit Message Format

Use **conventional commits with scopes** to keep history scannable:

```
type(scope): concise description of the change
```

**Types:** `feat`, `fix`, `chore`, `docs`, `refactor`, `test`
**Scopes:** Feature area being worked on (e.g., `map-v2`, `plan-workspace`, `etl`)

Examples from our actual history:
```
feat(map-v2): wire floating district detail + tether into shell
fix(map-v2): click district in plan opens full detail view
chore: update data snapshot 2026-02-16T01:28
docs: floating district detail implementation plan
feat(plan-workspace): implement task checklist + task form right panel
```

For larger commits, add bullet points in the body:
```
feat(map-v2): port detail components to v2 district panel

- Moved DistrictHeader, Info, Data+Demographics tabs
- Updated imports to use new panel path
- Removed old simplified panel component
```

---

## Cloud Deployment (Vercel + Supabase)

### How Deployment Works

The project uses a **continuous deployment** workflow:

1. **Push to GitHub** → Vercel automatically detects the new commit
2. **Vercel builds** → Runs `prisma generate && next build`
3. **Vercel deploys** → New version goes live at `territory-plan.vercel.app`

This means every `git push` triggers a new deployment. No manual deploy steps needed.

### Commit → Deploy Flow

```
git add <files>
git commit -m "Description of changes"
git push origin <branch-name>
```

After pushing:
- Check **Vercel Dashboard** → **Deployments** to see build progress
- Build logs show any errors (TypeScript, missing dependencies, etc.)
- Once green, the site is live

### Environment Variables

**Two places store environment variables:**

| Location | Purpose | Variables |
|----------|---------|-----------|
| `.env` (local) | Local development | DATABASE_URL, DIRECT_URL, NEXT_PUBLIC_* |
| Vercel Dashboard | Production deployment | Same variables, but with production values |

**Important:** Changes to `.env` only affect local dev. Production uses Vercel's environment variables.

To update production env vars:
1. Vercel Dashboard → Project → Settings → Environment Variables
2. Edit the value
3. Redeploy for changes to take effect

### Database Changes (Supabase)

**Schema changes** (adding columns, tables):

> **Important:** `npx prisma migrate dev` fails due to historical migration issues (Jan 2026 consolidation — the shadow database can't replay old migrations). Use this workaround instead:

```bash
# 1. Update prisma/schema.prisma with the desired changes

# 2. Generate a migration SQL file
npx prisma migrate diff \
  --from-schema-datasource prisma/schema.prisma \
  --to-schema-datamodel prisma/schema.prisma \
  --script > prisma/migrations/YYYYMMDD_description/migration.sql

# 3. Apply the SQL directly
npx prisma db execute --file prisma/migrations/YYYYMMDD_description/migration.sql

# 4. Mark the migration as applied so Prisma's history stays in sync
npx prisma migrate resolve --applied "YYYYMMDD_description"
```

**Direct SQL** (for things Prisma doesn't support like PostGIS):
- Use Supabase Dashboard → SQL Editor
- Or run via: `npx prisma db execute --stdin < file.sql`

---

## ETL Workflow

### Running Data Loads

ETL scripts live in `scripts/etl/` and use Python 3 (**always `python3`**, not `python`):

```bash
cd scripts/etl
python3 run_etl.py --boundaries --shapefile ./data/nces_edge/EDGE_SCHOOLDISTRICT_TL24_SY2324.shp
python3 run_etl.py --enrollment
python3 run_etl.py --education-data --year 2022
```

### ETL Conventions

All loaders follow the same pattern:
1. `fetch_*()` — paginated API fetch (Urban Institute Education Data Portal)
2. `upsert_*()` — temp table bulk insert + `ON CONFLICT UPDATE`
3. `log_refresh()` — write to `data_refresh_logs` for audit trail

### Connection Notes

- Python scripts use `DIRECT_URL` (bypasses pgbouncer) — not `DATABASE_URL`
- Strip Supabase-specific params before passing to `psycopg2`
- Urban Institute API: base URL `https://educationdata.urban.org/api/v1`, uses `-1`/`-2` for missing data, max 10K records per page

### Data Snapshots

After significant data loads, commit a snapshot:
```
chore: update data snapshot 2026-02-16T01:28
```

### Authentication (Supabase Auth)

- Users log in via **Google OAuth**
- Supabase handles sessions and tokens
- Middleware (`src/middleware.ts`) protects routes
- API routes use `getUser()` to get current user

**To add team members:**
1. Google Cloud Console → OAuth consent screen → Test users
2. Add their email addresses
3. They can now sign in with Google

### Troubleshooting Deployments

| Issue | Solution |
|-------|----------|
| Build fails with TypeScript error | Fix the error locally, commit, push again |
| "Prisma Client not generated" | Already fixed - build script runs `prisma generate` |
| Old code still deployed | Check Vercel is building the latest commit; try "Redeploy" with cache disabled |
| Login redirect goes to localhost | Update Site URL in Supabase → Authentication → URL Configuration |
| Google OAuth "redirect_uri_mismatch" | Add exact callback URL to Google Cloud Console credentials |

### Quick Deploy Checklist

Before pushing changes that will deploy:

- [ ] Test locally with `npm run dev`
- [ ] Check for TypeScript errors with `npm run build`
- [ ] Commit with clear message
- [ ] Push to GitHub
- [ ] Watch Vercel build logs for errors
- [ ] Test the deployed site

---

## Testing Approach

### Current Reality

During rapid feature development, manual testing takes priority — verify in the browser with `npm run dev` after each task. Testing framework (Vitest + Testing Library) is set up and ready when the codebase stabilizes.

### Goal State

As the app matures, introduce tests for:
1. **Unit tests** — Pure logic (data transforms, store actions, utility functions)
2. **Integration tests** — API routes returning correct data
3. **Happy path tests** — Key user flows work end-to-end

### Manual Testing Checklist

After each implementation task:
- [ ] Run `npm run dev` and verify the feature works visually
- [ ] Check for console errors in browser dev tools
- [ ] Test edge cases (empty states, missing data, rapid clicks)
- [ ] Verify no regressions in adjacent features

---

## When Claude Encounters Issues

### Inconsistencies in the Codebase

- **Surface and discuss inconsistencies** across the codebase
- Don't silently pick one pattern—flag it for Sierra to decide
- Example: "Sierra, there are two different patterns for API error handling in this codebase. File A uses X, File B uses Y. Which should Claude follow?"

### When Something Breaks

- **Always explain why it broke**, not just how to fix it
- This helps Sierra learn and prevents the same issue in the future
- Walk through the cause → effect → solution

### When Claude Knows a Better Approach

- **Ask before making changes** to existing patterns
- Share knowledge about better/more modern approaches
- Frame it as an option, not a directive
- Example: "This works, but there's a more efficient way using async/await that would reduce these nested callbacks. Would Sierra like Claude to refactor, or keep the current approach for consistency?"

---

## Handling Big Tasks

When a task is larger than expected, use the **Design Doc → Implementation Plan → Execute** workflow described above. The implementation plan is the phase breakdown.

For very large features, Claude can use **parallel agents** to implement independent tasks simultaneously (e.g., building two unrelated components at the same time). Claude will flag when parallel work is possible and get Sierra's approval.

### Claude Code Skills

Claude uses structured skills as part of the workflow:

| Skill | When Used |
|-------|-----------|
| **Brainstorming** | Before any creative or design work — explores intent and requirements |
| **Plan writing** | After design approval — creates the task-by-task implementation plan |
| **Plan execution** | During implementation — works through plan tasks with commits |
| **Code review** | At checkpoints — verifies work against the plan and standards |
| **Parallel agents** | When multiple independent tasks can run simultaneously |

These skills ensure consistency across sessions — Claude follows the same process every time.

---

## Feedback Style

### How Claude Gives Sierra Feedback

- **Be direct and specific** — no gentle suggestions or hedging
- Specific examples work better than vague advice
- Example: "Cut the Kizik story" vs "make it shorter"
- Use bullet points for feedback and summaries

### How Sierra Gives Claude Feedback

- Sierra will be direct—Claude shouldn't interpret directness as frustration
- If something isn't working, Sierra will say so plainly
- Claude should ask clarifying questions if feedback is unclear

---

## Tech Stack Quick Reference

Full details in `Docs/TECHSTACK.md`. Key technologies:

| Layer | Technology |
|-------|------------|
| Framework | Next.js 16 + React 19 + TypeScript |
| Styling | Tailwind CSS 4 + Fullmind brand colors |
| State | Zustand (client) + TanStack Query (server) |
| Database | PostgreSQL + PostGIS + Prisma ORM |
| Maps | MapLibre GL JS (vector tiles via PostGIS) |
| Charts | Recharts |
| Hosting | Vercel (app) + Supabase (database + auth) |
| ETL | Python 3 scripts + Urban Institute API |
| Tests | Vitest + Testing Library |

---

## Learning Goals

Sierra wants to understand the coding ecosystem and process better. Claude should:

- Explain concepts as they come up naturally in the work
- Point out patterns and best practices in context
- Share the "why" behind technical decisions
- Make connections between different parts of the stack
- Treat every coding session as a learning opportunity

---

## Quick Reference Checklist

Before starting any feature, Claude should:

- [ ] Understand the goal and requirements
- [ ] **Brainstorm** the approach with Sierra
- [ ] **Write a design doc** and get Sierra's approval
- [ ] **Write an implementation plan** and get Sierra's approval
- [ ] **Create a feature branch immediately** (before any code changes)
- [ ] Execute task-by-task with clear comments
- [ ] **Commit after each task** (small, frequent commits with conventional format)
- [ ] Verify each task works in the browser
- [ ] Explain what was done and check for questions
