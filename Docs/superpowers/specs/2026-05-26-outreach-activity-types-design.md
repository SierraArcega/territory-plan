# Outreach Activity Types: "Email" + "Cold Call"

**Date:** 2026-05-26
**Status:** Approved (design)
**Branch:** `feat/outreach-activity-types`

## Summary

Add two new activity types — **Email** and **Cold Call** — grouped under a new
**Outreach** category. Both are lightweight, manually-logged sales touches that
sit alongside booked Meetings but are conceptually top-of-funnel. Each carries a
small set of type-specific fields stored in the existing `activity.metadata`
JSON column.

No database migration is required: `activity.type` is `VarChar(30)` and
`metadata` is an existing JSON column.

## Goals

- Reps can create an Email or a Cold Call activity from the activity-creation
  flow, picking the new **Outreach** category.
- Email captures: **subject line**, **direction** (outbound/inbound, default
  outbound), **thread/email link**.
- Cold Call captures: **call result** (connected / voicemail / no answer /
  gatekeeper).
- Both types can be linked to a district and to contacts (already supported
  generically — see below).
- Type-specific fields render and persist correctly in **both** the create
  modal and the edit/view panel.

## Non-Goals

- No calendar-sync auto-detection of these types (`detectActivityType()` is
  untouched). Emails and cold calls are logged by hand.
- No new outcome/sentiment/deal-impact semantics — the existing outcome panel
  applies unchanged. "Call result" is distinct from activity outcome.
- No internal "Fullmind Attendees" picker for outreach activities (an email or
  cold call is a single rep's touch, not a team event).
- No broad fix of the pre-existing `thought_leadership` metadata-persistence
  bug in the view panel (flagged below, but out of scope).

## Current Architecture (verified)

Activity types are centralized in `src/features/activities/types.ts`:

- `ACTIVITY_CATEGORIES` — the source of truth; `ActivityType`,
  `ALL_ACTIVITY_TYPES`, and the category picker all derive from it via
  `as const`.
- `ACTIVITY_TYPE_LABELS`, `ACTIVITY_TYPE_ICONS` — `Record<ActivityType, …>`
  maps (emoji icons, by existing convention — not Lucide).
- `CATEGORY_LABELS`, `CATEGORY_ICONS`, `CATEGORY_DESCRIPTIONS`,
  `DEFAULT_TYPE_FOR_CATEGORY` — `Record<ActivityCategory, …>` maps.
- Per-type metadata interfaces + the `ActivityMetadata` union.

Because the label/icon/category maps are `Record<ActivityType|ActivityCategory, …>`,
**TypeScript fails to compile if any entry is missing** — our safety net.

Two consumers render the per-type fields, gated differently:

- **`ActivityFormModal.tsx`** (create): district picker is gated only by
  `type !== "road_trip"` (line ~678), so it is effectively universal; the
  `ContactSelect` (line ~621) is unconditional. The **type-specific Details**
  block (line ~723) and the **Fullmind Attendees** picker (line ~712) are both
  gated by `isEventCategory = events || thought_leadership` (line ~434).
- **`ActivityViewPanel.tsx`** (edit/view): the Details block is gated by
  `getCategoryForType(type) === "events"` (line ~84) — narrower. On save
  (`handleSave`, lines ~91–92), `metadata` is **set to null** unless the
  category is `events`. So editing+saving any non-events activity that has
  metadata would silently wipe it. This is a latent bug that we must avoid for
  outreach.

`EventTypeFields.tsx` switches on `type` and ends in `default: return null`.

## Design

### 1. `src/features/activities/types.ts`

- Add category `outreach: ["email", "cold_call"]` to `ACTIVITY_CATEGORIES`,
  placed immediately after `meetings` (logical adjacency; also determines its
  position in the category-picker grid).
- `ACTIVITY_TYPE_LABELS`: `email: "Email"`, `cold_call: "Cold Call"`.
- `ACTIVITY_TYPE_ICONS`: `email: "✉️"` (deliberately not `📧`, already used by
  `mixmax_campaign`), `cold_call: "📞"`.
- `CATEGORY_LABELS.outreach = "Outreach"`.
- `CATEGORY_ICONS.outreach = "📣"`.
- `CATEGORY_DESCRIPTIONS.outreach = "Cold calls and 1:1 email outreach"`.
- `DEFAULT_TYPE_FOR_CATEGORY.outreach = "email"`.
- New metadata interfaces, added to the metadata section and to the
  `ActivityMetadata` union:

  ```ts
  export interface EmailMetadata {
    subject?: string;
    direction?: "outbound" | "inbound";
    threadLink?: string;
  }

  export interface ColdCallMetadata {
    callResult?: "connected" | "voicemail" | "no_answer" | "gatekeeper";
  }
  ```

### 2. New field components (`components/event-fields/`)

Mirror the existing `WebinarFields.tsx` / `CourseFields.tsx` pattern and styling
exactly (brand hex values, `space-y-4`, label classes, focus ring). Each takes
`{ metadata, onMetadataChange }` and writes back via
`{ ...metadata, field: value || undefined }`.

- **`EmailFields.tsx`** — Subject (`text`), Direction (`select`: Outbound /
  Inbound, default Outbound when unset), Thread link (`url`).
- **`ColdCallFields.tsx`** — Call result (`select`: Connected / Voicemail /
  No answer / Gatekeeper).

### 3. `EventTypeFields.tsx`

- Import `EmailMetadata`, `ColdCallMetadata`, `EmailFields`, `ColdCallFields`.
- Add `case "email"` and `case "cold_call"` before `default: return null`,
  following the existing cast pattern
  (`metadata as EmailMetadata` / `onMetadataChange(m as unknown as Record<string, unknown>)`).

### 4. `ActivityFormModal.tsx` — decouple the Details gate

- Keep `isEventCategory` for the **Fullmind Attendees** picker (line ~712), so
  outreach activities do **not** show an internal-team attendee picker.
- Introduce a dedicated flag for the type-specific Details block (line ~723):

  ```ts
  const showTypeDetails =
    isEventCategory || typeCategory === "outreach";
  ```

  Gate the Details `<EventTypeFields … />` block on `showTypeDetails`. This also
  corrects the now-misleading "event"-named flag drift.

### 5. `ActivityViewPanel.tsx` — render + persist for outreach

- Extend the render gate (line ~84) so outreach shows the Details block:

  ```ts
  const cat = getCategoryForType(type);
  const showTypeDetails = cat === "events" || cat === "outreach";
  ```

- Extend the save guard (`handleSave`, lines ~91–92) so outreach metadata is
  preserved rather than nulled:

  ```ts
  const hasTypeFields = cat === "events" || cat === "outreach";
  const hasMetadata = hasTypeFields && Object.keys(metadata).length > 0;
  ```

  (Scope strictly to `outreach`; do not change `thought_leadership` behavior.)

## Data Flow

1. User picks **Outreach** → **Email** (or **Cold Call**) in the create modal.
2. `EventTypeFields` renders `EmailFields`/`ColdCallFields`; edits update local
   `metadata` state.
3. POST `/api/activities` writes `metadata` JSON as-is (route already accepts
   it; no validation change needed).
4. Contacts/district links flow through the existing
   `ContactSelect`/`DistrictSearchInput` and their junction tables — no change.
5. On reopen, `ActivityViewPanel` hydrates `metadata`, renders the same field
   components, and (with the guard fix) preserves them on save.

## Testing

- `src/app/api/activities/__tests__/route.test.ts` — add cases asserting POST
  accepts `type: "email"` and `type: "cold_call"`.
- A focused unit test (extend or add a `types` test) asserting:
  - `getCategoryForType("email") === "outreach"` and
    `getCategoryForType("cold_call") === "outreach"`.
  - `ALL_ACTIVITY_TYPES` includes both.
  - Label/icon entries exist for both (compile-time guaranteed, but assert for
    documentation/regression).
- The `Record<ActivityType, …>` / `Record<ActivityCategory, …>` exhaustiveness
  gives compile-time coverage for the map updates.
- Manual check: create an Email and a Cold Call, link a district + contact, set
  fields, save, reopen, edit, save again, confirm fields persist (guards the
  view-panel null bug).

## Risks / Notes

- **View-panel metadata-null bug** affects `thought_leadership` today and would
  affect `outreach` if we forgot the save-guard fix (§5). We fix it for
  outreach and leave a note that `thought_leadership` has the same latent issue.
- Emoji icon choices (`✉️` / `📞` / `📣`) are cosmetic and trivially adjustable.
- Category order: inserting `outreach` after `meetings` shifts the picker grid;
  acceptable and intentional.

## Files Touched

- `src/features/activities/types.ts` (category, types, labels, icons, metadata)
- `src/features/activities/components/event-fields/EmailFields.tsx` (new)
- `src/features/activities/components/event-fields/ColdCallFields.tsx` (new)
- `src/features/activities/components/event-fields/EventTypeFields.tsx` (cases)
- `src/features/activities/components/ActivityFormModal.tsx` (Details gate)
- `src/features/activities/components/ActivityViewPanel.tsx` (render + save gate)
- Tests: `route.test.ts` + a `types` unit test
