# Links

Text link patterns for inline content and navigation.

See `_foundations.md` for focus ring.

---

## Inline Link

For links within body text — email addresses, phone numbers, URLs.

```
text-[#6EA3BE] hover:underline
```

Inherits the surrounding font size. No underline by default; underline appears on hover.

```tsx
<a
  href="mailto:contact@example.com"
  className="text-[#6EA3BE] hover:underline focus-visible:ring-2 focus-visible:ring-[#403770]/30 focus-visible:outline-none rounded"
>
  contact@example.com
</a>
```

## Nav Link

Action-oriented navigation links — "Add Districts from Map", "View on Map".

```
text-[#403770] hover:text-[#F37167] transition-colors
```

No underline. Often paired with an icon on the left.

```tsx
<a
  href="/map"
  className="flex items-center gap-2 text-[#403770] hover:text-[#F37167] transition-colors focus-visible:ring-2 focus-visible:ring-[#403770]/30 focus-visible:outline-none rounded"
>
  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L15 4m0 13V4m0 0L9 7" />
  </svg>
  View on Map
</a>
```

## External Link

Same as inline link, with an external-link icon suffix and new-tab behavior.

```tsx
<a
  href="https://example.com"
  target="_blank"
  rel="noopener noreferrer"
  className="inline-flex items-center gap-1 text-[#6EA3BE] hover:underline focus-visible:ring-2 focus-visible:ring-[#403770]/30 focus-visible:outline-none rounded"
>
  Documentation
  <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
  </svg>
</a>
```

## Rules

- Focus ring from `_foundations.md` on all link types
- Always `cursor-pointer`
- Never use `text-decoration: none` on inline links — let underline appear on hover
- External links always open in new tab with `rel="noopener noreferrer"`

## Keyboard

Standard `<a>` keyboard behavior applies (`Tab` to focus, `Enter` to activate). See `_foundations.md` for focus ring conventions.

---

## Codebase Examples

| Component | File |
|---|---|
| DistrictDetailsCard (phone/email) | `src/features/map/components/panels/district/DistrictDetailsCard.tsx` |
| PlansView ("Add from Map") | `src/features/shared/components/views/PlansView.tsx` |
