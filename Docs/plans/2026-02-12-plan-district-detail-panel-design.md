# Plan District Detail Panel

## Summary

When viewing a territory plan, clicking a district or contact opens a sliding side panel showing full district details — no need to navigate away to the map view. The panel reuses existing district detail components from the map SidePanel and adds a plan-specific context section at the top.

---

## Interaction & Trigger Points

### From the Districts Tab
- Clicking anywhere on a DistrictCard (except action buttons like "View on Map" or "Remove") opens the SidePanel for that district
- Clicking a row in DistrictsTable opens the panel for that district
- Cards/rows show a pointer cursor on hover to indicate clickability

### From the Contacts Tab
- Clicking a ContactCard (except email/phone/LinkedIn links and edit/delete buttons) opens the SidePanel for that contact's district
- The panel opens scrolled to the contacts section, with the clicked contact visually highlighted

### Panel Behavior
- Slides in from the right (420px width, same as map panel)
- Overlays the plan content — plan view stays visible but dimmed slightly behind
- Close via X button, clicking outside, or pressing Escape
- Only one panel open at a time — clicking a different district swaps the content

---

## Panel Content Layout

### Panel Header
- District name, state badge, LEAID
- Close (X) button top-right
- Reuses existing DistrictHeader component

### Plan Context Section (NEW — only when opened from a plan)
- Light background card with the plan's color as left border accent
- **Targets:** Revenue target and Pipeline target (editable inline via DistrictTargetEditor)
- **Targeted Services:** Service badges (editable via ServiceSelector)
- **Plan Notes:** Plan-specific notes for this district (editable inline)
- **Tags:** District tags within this plan (editable, max 5)
- **Recent Activities:** Last 2-3 activities involving this district in this plan, with "View All" link that switches to Activities tab filtered to this district

### Existing Sections (reused from map SidePanel)
1. Fullmind Metrics (revenue, bookings, pipeline)
2. District Info (address, phone, locale)
3. Demographics Chart
4. Student Populations
5. Academic Metrics
6. Finance Data
7. Staffing & Salaries
8. Competitor Spend
9. Notes (district-level, separate from plan notes)
10. Tags (district-level)
11. Contacts List (with clicked contact highlighted if opened from Contacts tab)

---

## Technical Approach

### Components Modified

**DistrictCard.tsx & DistrictsTable.tsx**
- Add `onClick` handler calling `onDistrictClick(leaid)` callback
- Use `e.stopPropagation()` on existing action buttons to prevent panel opening

**ContactCard.tsx & ContactsTable.tsx**
- Add `onClick` handler calling `onContactClick(leaid, contactId)` callback
- Use `e.stopPropagation()` on email/phone/LinkedIn/edit/delete buttons

**PlansView.tsx / PlanTabs.tsx**
- Add local state: `selectedLeaid` and `highlightContactId`
- Pass open/close handlers to tab content
- Render PlanDistrictPanel when a district is selected

### New Component

**PlanDistrictPanel.tsx**
- Wrapper component that:
  - Fetches full district data via existing `useDistrict(leaid)` hook
  - Gets plan-specific data (targets, services, notes, tags) from the plan's district list
  - Fetches activities for this district within the plan
  - Renders Plan Context Section at top
  - Renders all existing panel section components below
  - Accepts `highlightContactId` prop for contact scroll/highlight behavior

### No Changes Needed
- Existing map SidePanel (stays independent)
- Zustand store (panel state is local to plan view)
- API routes (all data already available through existing queries)

### Data Sources
- Full district data: `useDistrict(leaid)` hook
- Plan-specific district data: Already in `useTerritoryPlan(id)` response
- Activities: Existing activity query filtered by plan + district
- Contacts: Already fetched via `usePlanContacts(planId)`
