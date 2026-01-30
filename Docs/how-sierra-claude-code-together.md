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

### Always Plan Before Implementation

1. **Discuss overall strategy** before writing code or making changes
2. **Ask clarifying questions one at a time** so Sierra can give complete answers
3. **Get approval on the approach** before implementation begins
4. **Focus on understanding requirements and flow first**

### Multi-Level Planning

1. Plan at the **high level** first (overall project goals and flow)
2. Then plan at the **task level** (specific file or feature details)
3. Implement the plan **only after both levels are planned and approved**

### Check Understanding

- After completing each task, ask if Sierra has questions about what was just done
- It's important that Sierra understands all the changes made together
- This supports Sierra's goal of learning the coding ecosystem and process

---

## Code Style Preferences

### Comments and Explanation

- **Explain code well using natural language comments**
- Walk through the logic as code is being written
- Help Sierra learn alongside Claude—don't just produce code, teach the "why"
- Use common language, avoid jargon without explanation

### File Organization

- **Single files are preferred** over splitting into many small modules
- Keep related functionality together when practical

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

Use detailed commit messages with bullet points:

```
feat: Add user dashboard filtering

- Added date range picker component
- Connected filter state to API query params
- Updated useEffect to refetch on filter change
- Added loading state during filter updates
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
```bash
# 1. Update prisma/schema.prisma
# 2. Push to Supabase
npx prisma db push
```

**Data loading** (ETL):
```bash
cd scripts/etl
python3 run_etl.py --boundaries --shapefile ./data/nces_edge/EDGE_SCHOOLDISTRICT_TL24_SY2324.shp
python3 run_etl.py --enrollment
python3 run_etl.py --education-data --year 2022
```

**Direct SQL** (for things Prisma doesn't support like PostGIS):
- Use Supabase Dashboard → SQL Editor
- Or run via: `npx prisma db execute --stdin < file.sql`

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

### Test as We Go

- Write tests alongside the code, not as an afterthought
- Testing is part of the development process, not a separate phase

### Testing Hierarchy

1. **Unit tests** — Test individual functions and components
2. **Integration tests** — Test how pieces work together
3. **Happy path tests** — Verify the main user flows work end-to-end

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

When a task is larger than expected:

1. **Break down the task** into manageable phases
2. **Propose the phases** to Sierra before starting
3. Get approval on the phased approach
4. Complete one phase at a time with check-ins between phases

Example breakdown:
```
Phase 1: Set up data model and database schema
Phase 2: Build API endpoints
Phase 3: Create frontend components
Phase 4: Connect frontend to API
Phase 5: Add error handling and edge cases
Phase 6: Write tests
```

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

## Learning Goals

Sierra wants to understand the coding ecosystem and process better. Claude should:

- Explain concepts as they come up naturally in the work
- Point out patterns and best practices in context
- Share the "why" behind technical decisions
- Make connections between different parts of the stack
- Treat every coding session as a learning opportunity

---

## Quick Reference Checklist

Before starting any task, Claude should:

- [ ] Understand the goal and requirements
- [ ] Plan the approach at high level and task level
- [ ] Get Sierra's approval on the plan
- [ ] **Create a feature branch immediately** (before any code changes)
- [ ] Write code with clear comments
- [ ] **Commit early and often** (small, frequent commits throughout)
- [ ] Write tests alongside the code
- [ ] Explain what was done and check for questions
