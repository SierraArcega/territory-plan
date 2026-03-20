# Backend Context: Road Trip District Stops

## Existing Schema

### ActivityDistrict junction table
- `activityId`, `districtLeaid` (composite PK)
- `warningDismissed` (Boolean)
- `visitDate`, `visitEndDate` (DateTime?)
- **Missing:** `position` (for ordering), `notes` (per-stop notes)

### District table
- `leaid` (PK), `name`, `stateAbbrev`, `stateFips`, enrollment, location data

### Activity table
- Standard fields: id, type, title, notes, startDate, endDate, status, metadata
- Relations: districts, plans, contacts, states, expenses, attendees, relations

## Existing API Endpoints

| Endpoint | Purpose |
|----------|---------|
| `POST /api/activities` | Create activity with districts (accepts visitDate/visitEndDate per district) |
| `GET /api/activities/[id]` | Get activity with all relations |
| `PATCH /api/activities/[id]` | Update activity, can update district visit dates |
| `POST /api/activities/[id]/districts` | Link districts to existing activity |
| `DELETE /api/activities/[id]/districts/[leaid]` | Unlink district |
| `GET /api/admin/districts/search?q=` | Search districts by name/LEAID/state |

## Existing Hooks

| Hook | Purpose |
|------|---------|
| `useCreateActivity()` | Create with districts |
| `useUpdateActivity()` | Update visit dates |
| `useLinkActivityDistricts()` | Link districts post-creation |
| `useUnlinkActivityDistrict()` | Unlink single district |

## Changes Needed

1. **Add `position` and `notes` to ActivityDistrict** - new migration
2. **Update API endpoints** to accept/return position and notes
3. **Auto-create Visit activities** when road trip with stops is saved
4. **Link auto-created visits** to the road trip via ActivityRelation
