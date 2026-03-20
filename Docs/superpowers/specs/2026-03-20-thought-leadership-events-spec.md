# Feature Spec: Thought Leadership Events

**Date:** 2026-03-20
**Slug:** thought-leadership-events
**Branch:** worktree-thought-leadership-events

## Requirements

Add a new activity category "Thought Leadership" to the New Activity modal with four subcategories:
- Webinar
- Speaking Engagement
- Professional Development Session
- Course

Each subcategory has unique metadata fields. The category appears as a 5th tile in the existing category picker grid.

## Visual Design

- **Category tile:** 💡 icon, "Thought Leadership" label, "Webinars, talks, PD sessions, and courses" description
- **Layout:** Follows existing 2x2 grid pattern (becomes 2x3 or 3x2 with 5 tiles)
- **Subtype picker:** Grid of 4 subcategory tiles after selecting Thought Leadership
- **Form:** Same two-panel layout as existing activity forms (left: details, right: tabs)

## Subcategory Design

### Webinar (🖥️)
- **Label:** "Webinar"
- **Fields:** Platform URL, Time (HH:mm), Topic
- **Metadata:** `{ platformUrl?: string, time?: string, topic?: string }`

### Speaking Engagement (🎙️)
- **Label:** "Speaking Engagement"
- **Fields:** Address (geocoded via AddressInput), Time (HH:mm), Topic
- **Metadata:** `{ address?: string, addressLat?: number, addressLng?: number, time?: string, topic?: string }`

### Professional Development Session (📋)
- **Label:** "PD Session"
- **Fields:** Address (geocoded via AddressInput), Time (HH:mm), Topic
- **Metadata:** `{ address?: string, addressLat?: number, addressLng?: number, time?: string, topic?: string }`

### Course (📚)
- **Label:** "Course"
- **Fields:** Platform URL, Provider, Topic
- **Metadata:** `{ platformUrl?: string, provider?: string, topic?: string }`

## Component Plan

### Existing components to reuse
- `ActivityFormModal.tsx` — add thought_leadership to category picker
- `EventTypeFields.tsx` — add routing for new subtypes
- `AddressInput` — reuse for Speaking Engagement and PD Session location fields
- `DinnerFields.tsx` — pattern reference for time + address + URL fields

### New components needed
- `WebinarFields.tsx` — Platform URL, Time, Topic fields
- `SpeakingEngagementFields.tsx` — Address, Time, Topic fields
- `ProfessionalDevelopmentFields.tsx` — Address, Time, Topic fields
- `CourseFields.tsx` — Platform URL, Provider, Topic fields

### Files to modify
- `src/features/activities/types.ts` — add category, types, labels, icons, descriptions, metadata interfaces
- `src/features/activities/outcome-types.ts` — add thought_leadership outcomes + new attendees_engaged outcome
- `src/features/activities/components/ActivityFormModal.tsx` — add category tile
- `src/features/activities/components/event-fields/EventTypeFields.tsx` — add subtype routing
- `src/app/api/activities/route.ts` — validation will auto-work since it checks against ALL_ACTIVITY_TYPES

## Outcome Types

Reuse Events outcomes + new attendees_engaged:
- `contacts_made` — "Contacts Made"
- `meetings_scheduled` — "Meetings Scheduled"
- `pipeline_generated` — "Pipeline Generated"
- `attendees_engaged` — "Attendees Engaged" (NEW)

## Statuses

Standard: planned, completed, cancelled

## Default Type

When creating from category tile: defaults to `webinar`

## States

- **Loading:** N/A (form is local state until submit)
- **Empty:** Standard empty form with required title field
- **Error:** Standard form validation (title required, dates optional)

## Out of Scope

- Calendar sync for Thought Leadership events (uses existing manual creation flow)
- Custom status lifecycle (no extended statuses like conferences)
- Expense tracking specific to Thought Leadership (uses existing expense tab)
- Import from external platforms
