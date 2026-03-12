# Empty States

Empty states are placeholder layouts shown when a view or card has no data to display, providing context and guiding users toward meaningful next actions.

See _foundations.md for disabled/empty pattern.

---

## Full-Page Empty State

A centered prompt used when a primary view contains no data. Combines an icon, heading, description, and a CTA button to orient the user and provide a clear path forward.

**Container:** `flex flex-col items-center justify-center gap-3 py-10`

**Icon:** `w-10 h-10` stroke icon in `text-[#C2BBD4]`, `strokeWidth={1.5}`

**Heading:** `text-sm font-semibold text-[#6E6390]`

**Description:** `text-xs text-[#A69DC0] text-center max-w-[280px]`

**CTA:** Primary button (see `Navigation/buttons.md`) — typically "Create Your First [Entity]"

```tsx
import { MapIcon } from "lucide-react";

function PlansEmptyState() {
  return (
    <div className="flex flex-col items-center justify-center gap-3 py-10">
      <MapIcon
        className="w-10 h-10 text-[#C2BBD4]"
        strokeWidth={1.5}
      />
      <p className="text-sm font-semibold text-[#6E6390]">No plans yet</p>
      <p className="text-xs text-[#A69DC0] text-center max-w-[280px]">
        Create your first territory plan to start organizing your accounts and
        tracking progress.
      </p>
      <button
        className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-[#403770] rounded-lg hover:bg-[#322a5a] transition-colors focus-visible:ring-2 focus-visible:ring-[#403770]/30 focus-visible:outline-none"
      >
        Create Your First Plan
      </button>
    </div>
  );
}
```

---

## Card Inline Empty State

Used inside metric cards and panels when specific data is unavailable. Displays a short text message centered in the card's content area.

**Text:** `text-lg text-[#A69DC0]` centered in the card's content area.

No CTA is included — the user cannot resolve missing data from this context.

**Examples:** "No finance data", "No ratio data", "No activities yet"

```tsx
function FinanceCardEmptyState() {
  return (
    <div className="flex items-center justify-center h-full">
      <p className="text-lg text-[#A69DC0]">No finance data</p>
    </div>
  );
}
```

---

## Codebase Examples

| Component | Type | File |
|-----------|------|------|
| Plans empty state | Full-Page | `src/features/shared/components/views/PlansView.tsx` |
| Finance card empty | Card Inline | `src/features/map/components/panels/district/FinanceCard.tsx` |
| Staffing card empty | Card Inline | `src/features/map/components/panels/district/StaffingCard.tsx` |
| Tasks empty state | Full-Page | `src/features/tasks/components/TaskList.tsx` |
| Contacts empty state | Full-Page | `src/features/map/components/panels/district/ContactsTab.tsx` |
