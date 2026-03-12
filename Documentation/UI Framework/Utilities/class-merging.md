# Class Merging

Merges Tailwind CSS class strings with conflict resolution, eliminating duplicate or overridden utility classes.

---

## API

```ts
import { cn } from "@/features/shared/lib/cn"

cn(...inputs: ClassValue[]): string
```

`ClassValue` accepts strings, arrays, objects with boolean values, `undefined`, and `null`. Powered by `clsx` for conditional logic and `tailwind-merge` for conflict resolution.

---

## Usage

### Basic merging

```ts
cn("px-4 py-2", "text-sm font-medium")
// → "px-4 py-2 text-sm font-medium"
```

### Conditional classes

```ts
cn(
  "rounded-lg border px-4 py-2 text-sm font-medium transition-colors",
  isActive ? "bg-[#403770] text-white" : "bg-white text-[#403770]",
  isDisabled && "opacity-50 cursor-not-allowed"
)
```

Object syntax is also valid:

```ts
cn("btn", {
  "bg-[#403770] text-white": variant === "primary",
  "border border-[#D4CFE2]": variant === "ghost",
  "opacity-50 pointer-events-none": disabled,
})
```

### Tailwind conflict resolution

`tailwind-merge` keeps the last-winning value when two classes target the same property:

```ts
cn("px-4 px-6")          // → "px-6"
cn("text-sm", "text-lg") // → "text-lg"
cn("bg-red-500", "bg-[#403770]")  // → "bg-[#403770]"
```

This makes it safe to pass override classes from a parent:

```tsx
// Component with base styles + caller-provided overrides
function Badge({ className }: { className?: string }) {
  return (
    <span className={cn("rounded-full bg-[#F37167] px-2 py-0.5 text-xs font-medium text-white", className)}>
      {children}
    </span>
  )
}

// Caller overrides background without needing to reset anything
<Badge className="bg-[#6EA3BE]" />
// → "rounded-full px-2 py-0.5 text-xs font-medium text-white bg-[#6EA3BE]"
```

### Spreading into JSX

```tsx
<div
  className={cn(
    "flex items-center gap-2 rounded-lg p-4",
    variant === "card" && "border border-[#D4CFE2] bg-white shadow-sm",
    className
  )}
/>
```

---

## Behavior Notes

- Returns an empty string if all inputs are falsy — does not throw.
- Preserves class order for non-conflicting utilities.
- Handles arbitrary values (`bg-[#403770]`, `w-[200px]`) correctly.
- Does not deduplicate non-conflicting classes (e.g., `cn("p-4", "p-4")` → `"p-4"` because tailwind-merge deduplicates same values).
- Does not validate that class names exist in your Tailwind config.

---

## Related

- [tokens.md](../tokens.md) — canonical color and spacing values to pass into `cn`
- [_foundations.md](./_foundations.md) — utilities overview
