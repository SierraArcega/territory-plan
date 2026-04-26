# Leaderboard Image Endpoint — Design Spec

**Date:** 2026-04-16
**Status:** Design approved
**Branch:** TBD
**Motivation:** Enable a scheduled remote agent to post a daily leaderboard snapshot to Slack at 8 AM CT. Remote agents have no browser, so we render the image server-side and let the agent fetch it as a PNG.

## Summary

Adds a new server-rendered PNG endpoint (`GET /api/leaderboard-image`) that returns a branded snapshot of the Revenue Overview leaderboard tab. Auth is via a shared bearer secret so a headless scheduled agent can call it. Data fetching is extracted from the existing `/api/leaderboard` route into a shared server function so both endpoints stay in sync. The PNG is rendered with `next/og` (Satori) — no browser, no extra runtime cost.

## Goals

- Headless-callable PNG of the Revenue Overview leaderboard, suitable for Slack
- Brand-aligned visual presentation (Fullmind plum palette, body font)
- Single source of truth for leaderboard data (no logic duplication between routes)
- Production-ready secret-based auth that a Vercel-hosted route + scheduled agent can both reach

## Non-Goals

- Initiative tab rendering (Revenue Overview only for v1)
- Avatars (text-only names — avoids extra image fetches and Satori SVG quirks)
- Caching — daily call volume is too low to bother
- Configurable FY selection via query params (FY context is hardcoded for v1; can be added if a second use case appears)
- Multi-tab / multi-channel routing logic (the scheduling agent picks the channel, not this route)

## Architecture

### Request flow

```
Scheduled remote agent (8 AM CT daily)
  → GET https://<deployment>/api/leaderboard-image
       Authorization: Bearer ${LEADERBOARD_IMAGE_SECRET}
  → Route validates bearer secret (401 if wrong/missing)
  → Calls fetchLeaderboardData() — same function used by /api/leaderboard
  → Builds JSX layout, hands to next/og ImageResponse
  → Returns image/png, Cache-Control: no-store
  → Agent receives PNG, posts to Slack via Slack MCP connector
       (#test-automations during testing, #sales- in production)
```

### Files touched

**New:**
- `src/app/api/leaderboard-image/route.ts` — route handler
- `src/features/leaderboard/lib/fetch-leaderboard.ts` — extracted data-fetch function
- `src/features/leaderboard/lib/image-layout.tsx` — JSX layout for the PNG (separate file because Satori-targeted JSX has different idioms than React UI)

**Modified:**
- `src/app/api/leaderboard/route.ts` — refactored to call the new shared `fetchLeaderboardData()`
- `.env.example` — add `LEADERBOARD_IMAGE_SECRET`

### Runtime

- **Node runtime** (not Edge). Reason: existing leaderboard fetch logic uses Prisma + raw SQL (`pg` Pool), neither of which run on Edge. `next/og`'s `ImageResponse` works fine in Node.

### Auth

- Validates `Authorization: Bearer <secret>` header against `process.env.LEADERBOARD_IMAGE_SECRET`
- Returns `401` plain text if header is missing, malformed, or secret mismatches
- Returns `500` plain text if `LEADERBOARD_IMAGE_SECRET` env var is unset (misconfiguration)
- Constant-time string comparison (`crypto.timingSafeEqual`) to defeat timing attacks — even though this isn't a high-value secret, it's free to do correctly

### Data fetching

- Extract the entire data-assembly block currently inside `src/app/api/leaderboard/route.ts` into a new `fetchLeaderboardData(opts)` function in `src/features/leaderboard/lib/fetch-leaderboard.ts`
- Function signature: `fetchLeaderboardData(opts?: { includeAdmins?: boolean }) → Promise<LeaderboardPayload>`
- Both routes call this function. The original `/api/leaderboard` route keeps its Supabase auth check; only the data fetch is shared.
- Image route hardcodes the FY column mapping: `revenue=currentFY`, `minPurchases=currentFY`, `pipeline=nextFY`, `targeted=nextFY`. (The fetch returns all FY variants on each entry — the image layout picks which fields to render.)

### Image layout

**Dimensions:** `1200 px wide × auto height`. Height grows with row count via flex column.

**Vertical structure:**

1. **Header band** (plum `#403770` background, off-white text):
   - Title: "Fullmind Sales Leaderboard"
   - Subtitle line: weekday + date (e.g., "Thursday, April 16, 2026")
   - FY context line: "Revenue & Min Purchases · FY26 · Pipeline & Targets · FY27"
   - Active initiative name (small, right-aligned)
2. **Column headers** (surface raised `#F7F5FA`, plum text):
   - `#` · `Rep` · `Revenue (FY26)` · `Min Purchases (FY26)` · `Pipeline (FY27)` · `Targeted (FY27)`
3. **Rep rows** (alternating `#FFFCFA` / `#F7F5FA` backgrounds, body text `#6E6390`)
   - Rank, full name, four currency values
4. **Team totals footer** (bold, plum text on hover-tint `#EFEDF5` background)
   - Single row labeled "Team Total" in the rep column
   - Same four currency columns, summed across all reps
   - Does NOT show the "unassigned" admin-portion subtotals that exist in the API response — keep the footer to one clean row for at-a-glance readability

**Currency formatting:** short-form (`$1.2M`, `$450K`, `$0`) so columns stay narrow and readable at PNG scale.

**Typography:**
- **Plus Jakarta Sans** (the only brand font per `tokens.md`)
- Two weights loaded as TTFs and fetched once at module init, reused across requests: 400 (body) and 600 (headers, footer totals)
- TTFs sourced from Google Fonts (already the project's font source)

**No icons.** Lucide SVGs render unreliably in Satori. Skip them.

### Error handling

- **DB fetch failure:** route still returns a 200 PNG containing "Leaderboard unavailable — check logs". Reason: a 5xx response would surface as a generic Slack error and obscure the issue; a visible PNG with the failure mode is more diagnosable.
- **Missing/wrong bearer secret:** 401 plain text response (not a PNG)
- **Missing `LEADERBOARD_IMAGE_SECRET` env var:** 500 plain text response — never silently treat as "no auth required"

### Configuration

New env var:
```
LEADERBOARD_IMAGE_SECRET=<long random string>
```

Set in:
- `.env.example` (placeholder)
- Vercel project: production + preview environments
- Passed by the scheduled agent via `Authorization: Bearer ...` header

Generation: `openssl rand -hex 32` or equivalent.

## Testing

### Manual testing path

1. Generate secret, set in local `.env.local` and on Vercel
2. Hit `http://localhost:3005/api/leaderboard-image` with bearer header in Postman/curl — confirm PNG renders, displays expected data
3. Visual check: open the PNG, confirm columns, formatting, branding match the design
4. Deploy to Vercel preview, repeat against the preview URL
5. Test the scheduled trigger end-to-end against `#test-automations` (not `#sales-`) until visually approved
6. Switch trigger destination to `#sales-` once approved

### Automated tests

- Unit test for `fetchLeaderboardData()` — same shape as the existing `/api/leaderboard` integration test (mock Prisma, verify shape)
- Route test for `/api/leaderboard-image` — verify 401 on missing/wrong secret, verify 200 + `image/png` content-type with valid secret
- No snapshot test of the PNG bytes (too brittle); rely on manual visual review

## Open questions

None for v1. Items to revisit if a second use case appears:
- Configurable FY selection via query params
- Configurable column set
- Optional caching with stale-while-revalidate

## Out-of-scope follow-ups (deferred)

- Initiative tab variant
- Avatars (would need image fetching + Satori-compatible image embedding)
- Slack-blocks alternative (rich block layout instead of an image) — keep this as a fallback if the image approach has issues
