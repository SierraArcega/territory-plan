# Contact Filters & Persona Normalization Design

**Date:** 2026-02-04
**Status:** Approved
**Branch:** `feature/contact-filters-normalization` (to be created)

## Problem

The contacts system has inconsistent persona handling:
- UI components hardcode 4 personas: `champion`, `decision_maker`, `influencer`, `end_user`
- Database stores free-form strings with 15 department-based values from Clay
- Filters don't match actual data, making them useless

## Solution

Create a single source of truth for persona and seniority level values based on actual database content, then update all components to use these canonical lists.

## Canonical Values

### Persona (Department) - 15 values

| Persona | Current Count |
|---------|---------------|
| Executive Leadership | 1,922 |
| Finance & Business Operations | 1,812 |
| Student Services & Support | 1,553 |
| Academic Leadership | 926 |
| Curriculum & Instruction | 798 |
| Technology & Information Systems | 705 |
| Human Resources | 549 |
| Special Education | 496 |
| Communications & Community Engagement | 224 |
| Federal Programs & Compliance | 216 |
| Operations & Facilities | 87 |
| Assessment & Accountability | 72 |
| Administrative Support | 72 |
| Innovation & Special Programs | 31 |
| Legal & Compliance | 22 |

### Seniority Level - 7 values

| Seniority Level | Current Count |
|-----------------|---------------|
| Executive Leadership | 2,822 |
| Director Level | 2,734 |
| Manager/Coordinator Level | 2,009 |
| Senior Leadership | 1,058 |
| Specialist Level | 799 |
| Administrative Support | 60 |
| School-Level Leadership | 3 |

## Implementation Plan

### Commit 1: Add contactTypes.ts constants file

Create `src/lib/contactTypes.ts` with:
- `PERSONAS` array constant
- `SENIORITY_LEVELS` array constant
- TypeScript types: `Persona`, `SeniorityLevel`
- `PERSONA_COLORS` mapping with bg/text/border colors
- `SENIORITY_COLORS` mapping with bg/text colors

### Commit 2: Update ContactsTable and ContactCard

- Remove local `PERSONA_COLORS` and `SENIORITY_COLORS` constants
- Import from `@/lib/contactTypes`
- Update badge rendering to use new color mappings

### Commit 3: Update PlanTabs filter configuration

- Import `PERSONAS`, `SENIORITY_LEVELS` from contactTypes
- Replace hardcoded filter options with dynamic options from constants
- Rename "Persona" filter label to "Department" for clarity
- Add "By District" grouping option to contacts tab

### Commit 4: Update ContactsList form inputs

- Convert free-text persona input to `<select>` dropdown
- Convert free-text seniority input to `<select>` dropdown
- Import options from contactTypes

### Commit 5: Add API validation

- Update `contacts/route.ts` POST handler to validate persona/seniority
- Update `contacts/[id]/route.ts` PUT handler to validate persona/seniority
- Return 400 error for invalid values

### Commit 6: Add Clay webhook normalization (optional safety)

- Add `normalizePersona` helper function
- Add `normalizeSeniority` helper function
- Apply normalization to incoming Clay data

## Files Changed

| File | Action |
|------|--------|
| `src/lib/contactTypes.ts` | **CREATE** - Constants, types, colors |
| `src/components/plans/PlanTabs.tsx` | UPDATE - Import constants, fix filters |
| `src/components/plans/ContactsTable.tsx` | UPDATE - Import colors |
| `src/components/plans/ContactCard.tsx` | UPDATE - Import colors |
| `src/components/panel/ContactsList.tsx` | UPDATE - Dropdown inputs |
| `src/app/api/contacts/route.ts` | UPDATE - Add validation |
| `src/app/api/contacts/[id]/route.ts` | UPDATE - Add validation |
| `src/app/api/webhooks/clay/route.ts` | UPDATE - Add normalization |

## Color Scheme

### Persona Colors (by functional area)

```
Executive Leadership:                 Plum (#403770) - white text
Academic Leadership:                  Sage (#8AA891) - white text
Finance & Business Operations:        Light blue (#EEF5F8) - dark text
Technology & Information Systems:     Cyan tint (#E8F4F8) - dark text
Human Resources:                      Orange tint (#FFF3E0) - dark text
Curriculum & Instruction:             Green tint (#EDFFE3) - dark text
Special Education:                    Purple tint (#F3E8FF) - dark text
Student Services & Support:           Sky blue (#E0F2FE) - dark text
Communications & Community:           Yellow tint (#FEF3C7) - dark text
Federal Programs & Compliance:        Slate (#F1F5F9) - dark text
Operations & Facilities:              Stone (#F5F5F4) - dark text
Assessment & Accountability:          Emerald tint (#ECFDF5) - dark text
Administrative Support:               Gray (#F3F4F6) - dark text
Innovation & Special Programs:        Fuchsia tint (#FDF4FF) - dark text
Legal & Compliance:                   Red tint (#FEF2F2) - dark text
```

### Seniority Colors (hierarchy gradient)

```
Executive Leadership:       Plum (#403770) - white text
Senior Leadership:          Light plum (#5C4E8C) - white text
Director Level:             Steel blue (#6EA3BE) - white text
Manager/Coordinator Level:  Sage (#8AA891) - white text
Specialist Level:           Robin's egg (#C4E7E6) - plum text
Administrative Support:     Gray (#F3F4F6) - gray text
School-Level Leadership:    Sky blue (#E0F2FE) - dark text
```

## Testing

- Verify filters show all 15 persona options
- Verify filters show all 7 seniority options
- Verify "Group by District" works in Contacts tab
- Verify ContactsList dropdowns save correctly
- Verify API rejects invalid persona/seniority values
- Verify existing contact badges display with correct colors

## No Migration Required

Current database values already match the canonical lists (values were derived from existing data). Future data will be validated on input.
