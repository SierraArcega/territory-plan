# Season Tuning Guide

A conversational guide for adjusting leaderboard seasons, metrics, and weights using Claude Code. Anyone with full repo access can use this to fine-tune the competitive system without touching application code.

---

## How It Works

Seasons are configured entirely through database seed scripts in `prisma/seed/` (or `scripts/`). No application code changes are needed to:

- Adjust point values for existing metrics
- Add or remove tracked metrics for a season
- Change the combined score weighting (season/pipeline/take split)
- Modify tier thresholds
- Start a new season with soft reset

All changes are applied by editing the seed data and running the seed script against the database.

---

## Quick Reference: What You Can Tune

| What | Where | Effect |
|------|-------|--------|
| Point value per action | `SeasonMetric.pointValue` | How many points a rep earns per action |
| Which actions are tracked | `SeasonMetric.action` | What earns points this season |
| Season/Pipeline/Take blend | `Season.seasonWeight`, `.pipelineWeight`, `.takeWeight` | How much each dimension matters in Combined view |
| Tier thresholds | `SeasonTierThreshold.minPoints` | How many points to reach each tier |
| Soft reset depth | `Season.softResetTiers` | How many tiers reps drop between seasons |

---

## Conversations With Claude Code

Below are example prompts you can paste directly into Claude Code to make changes. Claude will generate the appropriate seed script or database update.

### Adjusting Point Values

> "The current season gives 10 pts per plan created and 5 pts per activity logged. Plans feel overweighted — reps are gaming it by creating empty plans. Change plans to 5 pts and activities to 8 pts."

> "Add a new metric to the current season: 'opportunity_created' worth 15 pts each. Label it 'Create an Opportunity'."

> "Revenue targeted is currently 1 pt per $10K. That's too granular — change it to 1 pt per $25K so only meaningful targets earn points."

### Adjusting Combined Weights

> "The combined score is currently 60/20/20 (season/pipeline/take). Reps are ignoring sales. Shift to 50/25/25 to give more credit to actual sales performance."

> "We want this season to be pure engagement — set combined weights to 80/10/10."

> "Pipeline data isn't reliable right now. Set pipeline weight to 0 and split it between season (70) and take (30) until the sync is fixed."

### Adjusting Tier Thresholds

> "Too many people are reaching Gold. Current thresholds are Iron 0, Bronze 100, Silver 300, Gold 600. Raise Gold to 800 and Silver to 400."

> "Nobody is getting out of Iron — the Bronze threshold of 100 is too high for our team size. Drop it to 50."

> "Show me what the tier distribution would look like with the current scores if I changed the thresholds to [0, 75, 200, 500]."

### Starting a New Season

> "Season 0 is ending. Start Season 1 with these changes:
> - Name: 'Season 1'
> - Start date: April 15, end date: July 15
> - Tracked metrics: plan_created (10 pts), activity_logged (8 pts), task_completed (3 pts)
> - Drop revenue_targeted as a metric
> - Combined weights: 50/25/25
> - Soft reset: drop 1 tier
> - Tier thresholds: Iron 0, Bronze 80, Silver 250, Gold 500"

> "Roll Season 0 into Season 1 with the same metrics and weights but fresh scores. Apply soft reset."

### Analyzing Current State

> "Show me the current season config — what metrics are tracked, what are the point values, and what are the combined weights?"

> "What does the tier distribution look like right now? How many reps are in each tier?"

> "If I changed plans from 10 pts to 5 pts, how would the current rankings change? Show me a before/after."

> "Who would be most affected if I shifted the combined weights from 60/20/20 to 40/30/30?"

---

## Principles for Tuning

### When to adjust point values
- A metric feels over/under-rewarded relative to effort
- Reps are gaming a low-effort action (e.g., creating empty plans)
- A new behavior needs more incentive (raise its points) or less (lower them)

### When to adjust combined weights
- The leaderboard doesn't reflect who you think the "best" reps are
- One dimension (season points, pipeline, take) is dominating unfairly
- A data source (like pipeline) is unreliable — reduce its weight temporarily

### When to adjust tier thresholds
- Too many reps clustered in one tier (raise/lower boundaries to spread them out)
- Top tier feels too easy or impossible to reach
- Team size changed significantly (smaller teams need lower thresholds)

### When to start a new season
- The current season's tracked metrics no longer align with business priorities
- You want to reset competition and re-energize engagement
- A quarter/half/year boundary feels like a natural moment

### General guidance
- **Change one thing at a time** and observe the effect before stacking changes
- **Check the math** — ask Claude to simulate the impact on current rankings before applying
- **Communicate changes to reps** — sudden point value shifts feel unfair if unexplained
- **Keep weights summing to 1.0** — `seasonWeight + pipelineWeight + takeWeight = 1.0` always
- **Log your reasoning** — when you make a change, leave a comment in the seed script explaining why

---

## Available Action Types

These are actions the platform can track. Use these identifiers in `SeasonMetric.action`:

| Action | Description | Type |
|--------|-------------|------|
| `plan_created` | Rep creates a new territory plan | count |
| `activity_logged` | Rep logs an activity (any type) | count |
| `task_completed` | Rep marks a task as done | count |
| `opportunity_created` | Rep creates a new opportunity | count |
| `revenue_targeted` | Rep sets district revenue targets on plans | dollar-based (pts per $X) |

New action types can be added as the platform grows — this requires a small code change to hook the action into the scoring system, plus a `SeasonMetric` entry.
