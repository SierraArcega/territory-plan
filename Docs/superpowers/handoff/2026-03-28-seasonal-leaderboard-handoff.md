I'm working on a Seasonal Leaderboard feature for the territory-plan project. The branch is `feat/seasonal-leaderboard` and is NOT ready for PR yet.

## What's been built

A gamified leaderboard system with:
- **4 Prisma models**: Season, SeasonMetric, SeasonScore, SeasonTierThreshold (migration applied, tables live in prod)
- **Season 0 seeded**: 27 reps backfilled with retroactive points from existing plans, activities, and revenue targets
- **Tier system**: Freshman (0pts) → Honor Roll (100pts) → Dean's List (300pts) → Valedictorian (900pts). No sub-ranks.
- **Combined score**: 60% season points / 20% pipeline / 20% take, normalized 0-100
- **3 UI placements**: Nav widget (above Profile in left sidebar, every page), Home widget (above avatar in profile sidebar), Full modal with Combined/Season Points/Take toggle
- **Animations**: Hover glow, 5-min shimmer, 3-4s ticker rotation, rank change pulse, dismissable per session
- **Point scoring hooks**: Awards points on plan creation and activity logging, cache invalidation on mutations
- **Aspirational tiers**: Empty tiers always shown in modal with "be the first to reach" messaging

## Key files
- Spec: `Docs/superpowers/specs/2026-03-28-seasonal-leaderboard-spec.md`
- Plan: `Docs/superpowers/plans/2026-03-28-seasonal-leaderboard.md`
- Tuning guide: `Docs/season-tuning-guide.md`
- Feature code: `src/features/leaderboard/` (components/, lib/)
- API routes: `src/app/api/leaderboard/` (route.ts + me/route.ts)
- Seed script: `scripts/seed-season-0.ts`
- Scoring logic: `src/features/leaderboard/lib/scoring.ts`
- Types: `src/features/leaderboard/lib/types.ts`

## What's next

**Admin Leaderboard Customization UI** — needs its own brainstorm/design/implementation cycle:
- New admin page/section for leaderboard config
- Tier threshold editor (editable point values per tier)
- Activity toggle checkboxes (which actions earn points this season)
- Point value editor per activity
- Combined score weight sliders (season/pipeline/take split)

This should go on its own branch (`feat/leaderboard-admin`) or continue on the current branch depending on preference. The existing admin section is at `src/app/admin/` and uses the expandable admin nav in the sidebar (`Sidebar.tsx` ADMIN_SUB_ITEMS).

## Other pending polish
- The `isMe` detection in the modal rankings may need fixing (currently comparing userId to rank number string)
- Revenue targeted scoring hook isn't wired into district target updates yet (only backfilled via seed)
- The spec/tuning guide docs still reference some old Iron/Bronze/Silver/Gold terminology in places
