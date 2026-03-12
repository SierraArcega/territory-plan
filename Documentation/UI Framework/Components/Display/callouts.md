# Callouts / Banners

Full-width promotional banners for onboarding prompts and feature highlights, and inline semantic alerts for contextual status messages.

See _foundations.md for semantic color palette.

---

## Promotional Banner

Full-width gradient banner used for onboarding prompts and feature announcements. Visually prominent with a rich purple gradient background.

**Container**

```
flex items-center gap-4 px-5 py-4 rounded-xl overflow-hidden relative
background: linear-gradient(135deg, #403770 0%, #5c4785 70%, #6b5a90 100%)
```

Uses `rounded-xl` — promotional banners are large card containers per `tokens.md`.

**Icon container**

```
w-10 h-10 rounded-lg bg-white/15 backdrop-blur-sm flex items-center justify-center flex-shrink-0
```

**Title**

```
text-sm font-semibold text-white
```

**Description**

```
text-xs text-white/60
```

**CTA button**

```
px-4 py-2 text-sm font-medium text-[#403770] bg-white rounded-lg hover:bg-white/90 transition-colors
```

**Dismiss button**

```
absolute top-3 right-3 text-white/50 hover:text-white/80 transition-colors focus-visible:ring-2 focus-visible:ring-white/30 focus-visible:outline-none
```

**TSX Example**

```tsx
import { X, CalendarDays } from "lucide-react";
import { useState } from "react";

export function PromotionalBanner() {
  const [dismissed, setDismissed] = useState(false);

  if (dismissed) return null;

  return (
    <div
      className="flex items-center gap-4 px-5 py-4 rounded-xl overflow-hidden relative"
      style={{
        background: "linear-gradient(135deg, #403770 0%, #5c4785 70%, #6b5a90 100%)",
      }}
    >
      {/* Icon */}
      <div className="w-10 h-10 rounded-lg bg-white/15 backdrop-blur-sm flex items-center justify-center flex-shrink-0">
        <CalendarDays className="w-5 h-5 text-white" />
      </div>

      {/* Content */}
      <div className="flex-1 min-w-0">
        <p className="text-sm font-semibold text-white">Connect your calendar</p>
        <p className="text-xs text-white/60 mt-0.5">
          Sync meetings and deadlines directly into your territory plan.
        </p>
      </div>

      {/* CTA */}
      <button className="px-4 py-2 text-sm font-medium text-[#403770] bg-white rounded-lg hover:bg-white/90 transition-colors flex-shrink-0">
        Connect
      </button>

      {/* Dismiss */}
      <button
        onClick={() => setDismissed(true)}
        aria-label="Dismiss banner"
        className="absolute top-3 right-3 text-white/50 hover:text-white/80 transition-colors focus-visible:ring-2 focus-visible:ring-white/30 focus-visible:outline-none"
      >
        <X className="w-4 h-4" />
      </button>
    </div>
  );
}
```

---

## Semantic Callout

Inline alert for contextual messages. Uses the semantic color system from `_foundations.md`.

**Container**

```
flex items-start gap-3 px-4 py-3.5 rounded-lg border
```

Apply background, border, and icon/title color based on the semantic variant table below.

**Icon**

```
w-[18px] h-[18px] flex-shrink-0 mt-0.5
```

Use the semantic strong color as the icon stroke.

**Semantic Color Variants**

| Semantic | Background | Border | Icon/Title color |
|----------|------------|--------|-----------------|
| Info | `bg-[#e8f1f5]` | `border-[#8bb5cb]` | `text-[#4d7285]` |
| Warning | `bg-[#fffaf1]` | `border-[#ffd98d]` | `text-[#997c43]` |
| Error | `bg-[#fef1f0]` | `border-[#f58d85]` | `text-[#c25a52]` |
| Success | `bg-[#F7FFF2]` | `border-[#8AC670]` | `text-[#5f665b]` |

**Title**

```
text-[13px] font-semibold
```

Apply the semantic title color from the table above.

**Description**

```
text-xs text-[#6E6390]
```

**TSX Example**

```tsx
import { Info } from "lucide-react";

interface SemanticCalloutProps {
  variant?: "info" | "warning" | "error" | "success";
  title: string;
  description?: string;
}

const variantStyles = {
  info: {
    container: "bg-[#e8f1f5] border-[#8bb5cb]",
    accent: "text-[#4d7285]",
    role: "status" as const,
  },
  warning: {
    container: "bg-[#fffaf1] border-[#ffd98d]",
    accent: "text-[#997c43]",
    role: "alert" as const,
  },
  error: {
    container: "bg-[#fef1f0] border-[#f58d85]",
    accent: "text-[#c25a52]",
    role: "alert" as const,
  },
  success: {
    container: "bg-[#F7FFF2] border-[#8AC670]",
    accent: "text-[#5f665b]",
    role: "status" as const,
  },
};

export function SemanticCallout({
  variant = "info",
  title,
  description,
}: SemanticCalloutProps) {
  const styles = variantStyles[variant];

  return (
    <div
      role={styles.role}
      className={`flex items-start gap-3 px-4 py-3.5 rounded-lg border ${styles.container}`}
    >
      <Info
        className={`w-[18px] h-[18px] flex-shrink-0 mt-0.5 ${styles.accent}`}
      />
      <div>
        <p className={`text-[13px] font-semibold ${styles.accent}`}>{title}</p>
        {description && (
          <p className="text-xs text-[#6E6390] mt-0.5">{description}</p>
        )}
      </div>
    </div>
  );
}

// Usage
<SemanticCallout
  variant="info"
  title="Quota period ending soon"
  description="Your current quota period closes in 3 days. Review open opportunities now."
/>
```

---

## Accessibility

- **Dismiss buttons** on promotional banners must include `focus-visible:ring-2 focus-visible:ring-white/30 focus-visible:outline-none`. See `Navigation/_foundations.md` for focus ring conventions.
- **`role="alert"`** for `error` and `warning` variants — triggers screen reader announcement immediately.
- **`role="status"`** for `info` and `success` variants — polite announcement that does not interrupt current speech.
- Include a descriptive `aria-label` on icon-only dismiss buttons (e.g., `aria-label="Dismiss banner"`).

---

## Codebase Examples

| Component | Type | File |
|-----------|------|------|
| Calendar connect banner | Promotional | `src/features/calendar/components/CalendarConnectBanner.tsx` |
| Plan performance alerts | Semantic | `src/features/map/components/panels/PlanPerfSection.tsx` |
