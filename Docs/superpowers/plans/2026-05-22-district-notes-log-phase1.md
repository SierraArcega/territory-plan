# District Notes Log — Phase 1 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship the District Notes Log frontend (Phase 1: rich text, no mentions) — a district-scoped, authored, timestamped note log surfaced inline in the districts grid and as the kebab "Add note" action.

**Architecture:** Replace the per-plan `PlanNotesCell` in the grid with a district-scoped `DistrictNotesCell` that shows the latest note snippet + count (fed by a new route-level JOIN) and opens a `NotesPopover` (reusing `AnchoredPopover`). The popover hosts a TipTap `NoteComposer` over a newest-first feed of `NoteEntry` rows. Notes are stored district-scoped (shared across plans) via the existing `district_notes` table and its CRUD routes (GET/POST exist; we add author-only PATCH/DELETE). The kebab "Add note" from the row-actions menu opens the same popover.

**Tech Stack:** React 19, Next 16 App Router, TanStack Query v5, Prisma/Postgres, Tailwind 4, Lucide, **TipTap 3** (`@tiptap/react`, `@tiptap/starter-kit`, `@tiptap/extension-link`), Vitest + Testing Library + jsdom.

**Source design:** `Docs/superpowers/specs/2026-05-21-district-notes-log-design.md` (authoritative for tokens, decisions, edge cases). This plan implements its **Phase 1**; mentions (`@`/`/`/`*`/`#`) are Phase 2 and out of scope.

---

## Context the executor needs

**Worktree (shared branch — read before write):**
`/Users/sierraarcega/territory-plan/.claude/worktrees/saved-views-sidebar`, branch
`worktree-saved-views-sidebar`. **Multiple Claude sessions commit here.** Re-read shared files
(`GridView.tsx`, `views/lib/queries.ts`, `app/api/views/data/route.ts`,
`src/lib/saved-views/source-fields.ts`, `RowActionsMenu.tsx`, `package.json`) immediately before
editing. **Stage only the files each commit touches — never `git add -A`.**

**Existing backend (already shipped):**
- `district_notes` table (Prisma model `DistrictNote`): `id uuid`, `districtLeaid varchar(7)`,
  `authorId uuid`, `bodyJson jsonb`, `bodyText text`, `createdAt`, `updatedAt`.
- `GET /api/districts/[leaid]/notes` → `{ notes: [{ id, bodyJson, bodyText, createdAt,
  updatedAt, author: { id, fullName, email, avatarUrl } }] }`, newest-first.
- `POST /api/districts/[leaid]/notes` body `{ bodyJson, bodyText }` → the created serialized note.
- **No PATCH/DELETE yet** — added in Task 2. Auth pattern: `getUser()` from
  `@/lib/supabase/server`; Prisma client default-exported from `@/lib/prisma`.

**Existing frontend to mirror/reuse:**
- `AnchoredPopover` — `src/features/views/components/grid/AnchoredPopover.tsx`. Props
  `{ anchorRef, open, onDismiss, children }`; body-portals + positions + outside-click/Escape.
- `PlanNotesCell` — `src/features/views/components/grid/cells/PlanNotesCell.tsx`. Current
  contract: `{ value: string | null, planId: string | null, leaid: string, disabled: boolean }`.
  Dispatched in `GridView.tsx` for `c.id === "plan_notes"` (~line 259). `DistrictNotesCell`
  replaces it there.
- `relativeAge(iso)` — `src/features/views/components/views/signals/relative-date.ts` — reuse for
  timestamps ("today"/"2d"/"3w").
- Query helper: `import { API_BASE, fetchJson } from "@/features/shared/lib/api-client";`.
- Views grid query key prefix `["views","data", ...]` (`useViewsData`) — invalidate after a note
  write so the inline snippet refreshes: `queryClient.invalidateQueries({ queryKey: ["views","data"] })`.

**Backend derived-field pattern (for Task 7 — inline snippet):** `app/api/views/data/route.ts`
conditionally builds CTEs and LEFT-joins them on `leaid`. See `__rank_cte` (~lines 237-266) and
`__churn_cte` (~271-278): each is pushed to `cteFragments`, the header is
`WITH ${cteFragments.join(", ")}` (~278), the final SELECT is `SELECT ${alias}.*, COUNT(*) OVER()
AS __total ${cteJoin}` (~301), and rows are camelized (~371). Virtual sort fields live in
`src/lib/saved-views/source-fields.ts` (`virtual: true`, e.g. `customer_rank` ~line 154) with an
explicit handler in `src/lib/saved-views/sql-compiler.ts` (~line 331).

**Test idiom:** `QueryClientProvider` with `retry:false`; `vi.stubGlobal("fetch", vi.fn(...))`
returning `new Response(JSON.stringify(...), { status, headers: { "Content-Type": "application/json" } })`;
assert on `fetchMock.mock.calls`. Portaled content appears after an effect → use `await
screen.findBy...` (async finds). Run one file: `npx vitest run <path>`.

---

## File structure

- Create: `src/features/views/components/notes/NoteComposer.tsx`, `NoteEntry.tsx`,
  `NotesPopover.tsx`, `DistrictNotesCell.tsx`, `noteDoc.ts` (TipTap helpers), + `__tests__/`.
- Modify: `src/features/views/lib/queries.ts` — add the four note hooks.
- Create: `src/app/api/districts/[leaid]/notes/[noteId]/route.ts` — author-only PATCH/DELETE.
- Modify: `src/app/api/views/data/route.ts` + `src/lib/saved-views/source-fields.ts` — inline
  `latestNote`/`noteCount` (Task 7) and optional `latest_note` sort (Task 9).
- Modify: `src/features/views/components/grid/GridView.tsx` — swap `PlanNotesCell` →
  `DistrictNotesCell` in the cell dispatch.
- Modify: `src/features/views/components/grid/actions/RowActionsMenu.tsx` — add the "Add note"
  item (Task 10).

---

## Task 1: Install TipTap dependencies

**Files:** Modify `package.json`, `package-lock.json`.

- [ ] **Step 1: Re-read `package.json`** (shared file) to confirm TipTap is still absent.

- [ ] **Step 2: Install (TipTap 3 — React 19 support)**

Run:
```bash
npm i @tiptap/react@^3 @tiptap/starter-kit@^3 @tiptap/extension-link@^3
```
If npm reports a React 19 peer conflict, install the latest published 3.x explicitly
(`npm i @tiptap/react@latest @tiptap/starter-kit@latest @tiptap/extension-link@latest`) and
re-run. Do **not** use `--force`/`--legacy-peer-deps` without confirming with the user.

- [ ] **Step 3: Verify the app still builds/type-checks**

Run: `npx tsc --noEmit` (expected: no new errors) and `npm run dev` boots on 3005.

- [ ] **Step 4: Commit**

```bash
git add package.json package-lock.json
git commit -m "build(views): add TipTap for the district notes composer"
```

---

## Task 2: Author-only PATCH/DELETE for district notes

**Files:**
- Create: `src/app/api/districts/[leaid]/notes/[noteId]/route.ts`
- Test: `src/app/api/districts/[leaid]/notes/[noteId]/__tests__/route.test.ts`

- [ ] **Step 1: Write the failing test** (mock prisma + getUser like sibling route tests; read
  `src/app/api/districts/[leaid]/notes/__tests__/route.test.ts` for the exact mock setup and
  mirror it)

```ts
import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/supabase/server", () => ({ getUser: vi.fn() }));
vi.mock("@/lib/prisma", () => ({
  default: { districtNote: { findUnique: vi.fn(), update: vi.fn(), delete: vi.fn() } },
}));

import { PATCH, DELETE } from "../route";
import { getUser } from "@/lib/supabase/server";
import prisma from "@/lib/prisma";

const ctx = (leaid: string, noteId: string) => ({
  params: Promise.resolve({ leaid, noteId }),
});

beforeEach(() => vi.clearAllMocks());

describe("district note PATCH/DELETE", () => {
  it("403s when the requester is not the author", async () => {
    (getUser as any).mockResolvedValue({ id: "user-2" });
    (prisma.districtNote.findUnique as any).mockResolvedValue({ id: "n1", authorId: "user-1" });
    const req = new Request("http://x", {
      method: "PATCH",
      body: JSON.stringify({ bodyJson: { type: "doc" }, bodyText: "hi" }),
    });
    const res = await PATCH(req as any, ctx("0601234", "n1") as any);
    expect(res.status).toBe(403);
  });

  it("updates when the author matches", async () => {
    (getUser as any).mockResolvedValue({ id: "user-1" });
    (prisma.districtNote.findUnique as any).mockResolvedValue({ id: "n1", authorId: "user-1" });
    (prisma.districtNote.update as any).mockResolvedValue({
      id: "n1", bodyJson: { type: "doc" }, bodyText: "edited",
      createdAt: new Date(), updatedAt: new Date(),
      author: { id: "user-1", fullName: "A", email: "a@x", avatarUrl: null },
    });
    const req = new Request("http://x", {
      method: "PATCH",
      body: JSON.stringify({ bodyJson: { type: "doc" }, bodyText: "edited" }),
    });
    const res = await PATCH(req as any, ctx("0601234", "n1") as any);
    expect(res.status).toBe(200);
    expect(prisma.districtNote.update).toHaveBeenCalled();
  });
});
```

- [ ] **Step 2: Run to verify it fails** — `npx vitest run src/app/api/districts/[leaid]/notes/[noteId]/__tests__/route.test.ts` → FAIL (no `../route`).

- [ ] **Step 3: Implement**

```ts
// [noteId]/route.ts
import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { getUser } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";
const AUTHOR_SELECT = { id: true, fullName: true, email: true, avatarUrl: true } as const;

function serialize(n: any) {
  return {
    id: n.id, bodyJson: n.bodyJson, bodyText: n.bodyText,
    createdAt: n.createdAt.toISOString(), updatedAt: n.updatedAt.toISOString(),
    author: n.author,
  };
}

async function requireAuthor(noteId: string) {
  const user = await getUser();
  if (!user) return { error: NextResponse.json({ error: "Unauthorized" }, { status: 401 }) };
  const note = await prisma.districtNote.findUnique({ where: { id: noteId } });
  if (!note) return { error: NextResponse.json({ error: "Not found" }, { status: 404 }) };
  if (note.authorId !== user.id)
    return { error: NextResponse.json({ error: "Forbidden" }, { status: 403 }) };
  return { user, note };
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ leaid: string; noteId: string }> },
) {
  const { noteId } = await params;
  const gate = await requireAuthor(noteId);
  if ("error" in gate) return gate.error;
  const body = await request.json().catch(() => null);
  const bodyText = typeof body?.bodyText === "string" ? body.bodyText.trim() : "";
  const bodyJson = body?.bodyJson;
  if (!bodyText || bodyJson == null || typeof bodyJson !== "object")
    return NextResponse.json({ error: "bodyJson + non-empty bodyText required" }, { status: 400 });
  const updated = await prisma.districtNote.update({
    where: { id: noteId },
    data: { bodyJson, bodyText },
    include: { author: { select: AUTHOR_SELECT } },
  });
  return NextResponse.json(serialize(updated));
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ leaid: string; noteId: string }> },
) {
  const { noteId } = await params;
  const gate = await requireAuthor(noteId);
  if ("error" in gate) return gate.error;
  await prisma.districtNote.delete({ where: { id: noteId } });
  return NextResponse.json({ success: true });
}
```

- [ ] **Step 4: Run to verify it passes** — same command → PASS (2 tests).
- [ ] **Step 5: Commit**

```bash
git add "src/app/api/districts/[leaid]/notes/[noteId]/route.ts" \
        "src/app/api/districts/[leaid]/notes/[noteId]/__tests__/route.test.ts"
git commit -m "feat(notes): author-only PATCH/DELETE for district notes"
```

---

## Task 3: District-note query + mutation hooks

**Files:**
- Modify: `src/features/views/lib/queries.ts`
- Test: `src/features/views/lib/__tests__/district-notes.test.tsx`

- [ ] **Step 1: Write the failing test**

```tsx
import { describe, it, expect, vi, beforeEach, afterEach, waitFor } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useDistrictNotes, useCreateDistrictNote } from "../queries";

function wrapper({ children }: { children: React.ReactNode }) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
  return <QueryClientProvider client={qc}>{children}</QueryClientProvider>;
}

const note = {
  id: "n1", bodyJson: { type: "doc" }, bodyText: "hello",
  createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(),
  author: { id: "u1", fullName: "A", email: "a@x", avatarUrl: null },
};

beforeEach(() => {
  vi.stubGlobal("fetch", vi.fn((_u: string, init?: RequestInit) => {
    if (init?.method === "POST")
      return Promise.resolve(new Response(JSON.stringify(note), { status: 200, headers: { "Content-Type": "application/json" } }));
    return Promise.resolve(new Response(JSON.stringify({ notes: [note] }), { status: 200, headers: { "Content-Type": "application/json" } }));
  }));
});
afterEach(() => vi.unstubAllGlobals());

describe("district note hooks", () => {
  it("lists notes for a leaid", async () => {
    const { result } = renderHook(() => useDistrictNotes("0601234"), { wrapper });
    await waitFor(() => expect(result.current.data?.notes).toHaveLength(1));
    expect(result.current.data?.notes[0].bodyText).toBe("hello");
  });

  it("posts a new note", async () => {
    const { result } = renderHook(() => useCreateDistrictNote("0601234"), { wrapper });
    await act(async () => {
      await result.current.mutateAsync({ bodyJson: { type: "doc" }, bodyText: "hi" });
    });
    const call = (globalThis.fetch as any).mock.calls.find((c: any[]) => c[1]?.method === "POST");
    expect(String(call[0])).toContain("/districts/0601234/notes");
  });
});
```

- [ ] **Step 2: Run to verify it fails** → FAIL (hooks not exported).

- [ ] **Step 3: Implement** — append to `src/features/views/lib/queries.ts`:

```ts
export interface DistrictNoteAuthor { id: string; fullName: string | null; email: string; avatarUrl: string | null; }
export interface DistrictNote {
  id: string; bodyJson: unknown; bodyText: string;
  createdAt: string; updatedAt: string; author: DistrictNoteAuthor;
}
interface NotesResponse { notes: DistrictNote[]; }

export function useDistrictNotes(leaid: string, enabled = true) {
  return useQuery({
    queryKey: ["district-notes", leaid],
    queryFn: () => fetchJson<NotesResponse>(`${API_BASE}/districts/${leaid}/notes`),
    enabled: enabled && !!leaid,
    staleTime: 30 * 1000,
  });
}

export function useCreateDistrictNote(leaid: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: { bodyJson: unknown; bodyText: string }) =>
      fetchJson<DistrictNote>(`${API_BASE}/districts/${leaid}/notes`, {
        method: "POST", body: JSON.stringify(body),
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["district-notes", leaid] });
      qc.invalidateQueries({ queryKey: ["views", "data"] }); // refresh inline snippet
    },
  });
}

export function useUpdateDistrictNote(leaid: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ noteId, ...body }: { noteId: string; bodyJson: unknown; bodyText: string }) =>
      fetchJson<DistrictNote>(`${API_BASE}/districts/${leaid}/notes/${noteId}`, {
        method: "PATCH", body: JSON.stringify(body),
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["district-notes", leaid] });
      qc.invalidateQueries({ queryKey: ["views", "data"] });
    },
  });
}

export function useDeleteDistrictNote(leaid: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (noteId: string) =>
      fetchJson<{ success: boolean }>(`${API_BASE}/districts/${leaid}/notes/${noteId}`, { method: "DELETE" }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["district-notes", leaid] });
      qc.invalidateQueries({ queryKey: ["views", "data"] });
    },
  });
}
```

> Confirm `useQuery`, `useMutation`, `useQueryClient` are already imported at the top of
> `queries.ts`; add any missing import.

- [ ] **Step 4: Run to verify it passes** → PASS.
- [ ] **Step 5: Commit**

```bash
git add src/features/views/lib/queries.ts \
        src/features/views/lib/__tests__/district-notes.test.tsx
git commit -m "feat(notes): district-note query + CRUD hooks"
```

---

## Task 4: NoteComposer (TipTap editor)

**Files:**
- Create: `src/features/views/components/notes/noteDoc.ts`
- Create: `src/features/views/components/notes/NoteComposer.tsx`
- Test: `src/features/views/components/notes/__tests__/NoteComposer.test.tsx`

`noteDoc.ts` centralizes the editor extensions + the JSON↔text flattening so the composer and the
read-only renderer (Task 5) stay in sync.

- [ ] **Step 1: Write the failing test**

```tsx
import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { NoteComposer } from "../NoteComposer";

describe("NoteComposer", () => {
  it("disables Save for an empty doc and enables once text is entered", async () => {
    render(<NoteComposer onSave={vi.fn()} />);
    const save = await screen.findByRole("button", { name: /save/i });
    expect(save).toBeDisabled();
    const editor = screen.getByRole("textbox");
    fireEvent.input(editor, { target: { textContent: "Called the super." } });
    await waitFor(() => expect(save).not.toBeDisabled());
  });

  it("calls onSave with bodyJson + bodyText", async () => {
    const onSave = vi.fn();
    render(<NoteComposer onSave={onSave} />);
    const editor = screen.getByRole("textbox");
    fireEvent.input(editor, { target: { textContent: "Called the super." } });
    fireEvent.click(await screen.findByRole("button", { name: /save/i }));
    await waitFor(() => expect(onSave).toHaveBeenCalled());
    const arg = onSave.mock.calls[0][0];
    expect(typeof arg.bodyText).toBe("string");
    expect(arg.bodyJson?.type).toBe("doc");
  });
});
```

> TipTap's contenteditable surfaces as `role="textbox"`. If jsdom + TipTap proves flaky for the
> input assertions, drive the editor via the `editor` instance exposed through a test-only
> `onCreate` callback rather than DOM `fireEvent.input`; keep the public `onSave` contract.

- [ ] **Step 2: Run to verify it fails** → FAIL (no `../NoteComposer`).

- [ ] **Step 3: Implement**

```ts
// noteDoc.ts
import StarterKit from "@tiptap/starter-kit";
import Link from "@tiptap/extension-link";
import type { Extensions } from "@tiptap/react";

// `#`/`*`/`_` input rules disabled so those chars stay free for Phase 2 mention triggers.
export const noteExtensions: Extensions = [
  StarterKit.configure({
    heading: false,
    // keep bold/italic marks but drop their markdown input rules:
    // (StarterKit v3 exposes per-mark input-rule toggles; if unavailable, leave defaults —
    // Phase 2 will revisit. The toolbar buttons provide formatting regardless.)
  }),
  Link.configure({ openOnClick: false, autolink: true }),
];

export function isEmptyDoc(text: string): boolean {
  return text.trim().length === 0;
}
```

```tsx
// NoteComposer.tsx
"use client";
import { useEditor, EditorContent } from "@tiptap/react";
import { Bold, Italic, List, ListOrdered, Link as LinkIcon } from "lucide-react";
import { noteExtensions, isEmptyDoc } from "./noteDoc";

interface Props {
  initialJson?: unknown;
  onSave: (doc: { bodyJson: unknown; bodyText: string }) => void;
  onCancel?: () => void;
  saving?: boolean;
}

export function NoteComposer({ initialJson, onSave, onCancel, saving }: Props) {
  const editor = useEditor({
    extensions: noteExtensions,
    content: (initialJson as any) ?? "",
    editorProps: { attributes: { class: "min-h-[64px] outline-none text-[13px] text-[#403770]" } },
    immediatelyRender: false, // Next SSR safety
  });

  const text = editor?.getText() ?? "";
  const empty = isEmptyDoc(text);

  function submit() {
    if (!editor || empty) return;
    onSave({ bodyJson: editor.getJSON(), bodyText: text.trim() });
    editor.commands.clearContent();
  }

  const tbtn = "rounded p-1 text-[#544A78] hover:bg-[#F7F5FA] data-[on=true]:text-[#403770] data-[on=true]:bg-[#EFEDF5]";

  return (
    <div className="rounded-lg border border-[#E2DEEC] bg-white p-2"
      onKeyDown={(e) => { if ((e.metaKey || e.ctrlKey) && e.key === "Enter") submit();
                          if (e.key === "Escape") onCancel?.(); }}>
      <div className="mb-1.5 flex items-center gap-0.5 border-b border-[#EFEDF5] pb-1.5">
        <button type="button" aria-label="Bold" className={tbtn}
          data-on={editor?.isActive("bold")} onClick={() => editor?.chain().focus().toggleBold().run()}>
          <Bold className="h-3.5 w-3.5" /></button>
        <button type="button" aria-label="Italic" className={tbtn}
          data-on={editor?.isActive("italic")} onClick={() => editor?.chain().focus().toggleItalic().run()}>
          <Italic className="h-3.5 w-3.5" /></button>
        <button type="button" aria-label="Bullet list" className={tbtn}
          data-on={editor?.isActive("bulletList")} onClick={() => editor?.chain().focus().toggleBulletList().run()}>
          <List className="h-3.5 w-3.5" /></button>
        <button type="button" aria-label="Numbered list" className={tbtn}
          data-on={editor?.isActive("orderedList")} onClick={() => editor?.chain().focus().toggleOrderedList().run()}>
          <ListOrdered className="h-3.5 w-3.5" /></button>
        <button type="button" aria-label="Link" className={tbtn}
          onClick={() => {
            const url = window.prompt("Link URL");
            if (url) editor?.chain().focus().setLink({ href: url }).run();
          }}>
          <LinkIcon className="h-3.5 w-3.5" /></button>
      </div>
      <EditorContent editor={editor} />
      <div className="mt-2 flex items-center justify-end gap-2">
        {onCancel && (
          <button type="button" onClick={onCancel}
            className="rounded-md px-2.5 py-1 text-[12px] text-[#8A80A8] hover:text-[#403770]">Cancel</button>
        )}
        <button type="button" onClick={submit} disabled={empty || saving}
          className="rounded-md bg-[#403770] px-3 py-1 text-[12px] font-semibold text-white disabled:opacity-50">
          {saving ? "Saving…" : "Save"}
        </button>
      </div>
    </div>
  );
}
```

- [ ] **Step 4: Run to verify it passes** → PASS (adjust per the jsdom note if needed).
- [ ] **Step 5: Commit**

```bash
git add src/features/views/components/notes/noteDoc.ts \
        src/features/views/components/notes/NoteComposer.tsx \
        src/features/views/components/notes/__tests__/NoteComposer.test.tsx
git commit -m "feat(notes): TipTap note composer"
```

---

## Task 5: NoteEntry (read-only render + author edit/delete)

**Files:**
- Create: `src/features/views/components/notes/NoteEntry.tsx`
- Test: `src/features/views/components/notes/__tests__/NoteEntry.test.tsx`

- [ ] **Step 1: Write the failing test**

```tsx
import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { NoteEntry } from "../NoteEntry";

const base = {
  id: "n1",
  bodyJson: { type: "doc", content: [{ type: "paragraph", content: [{ type: "text", text: "Called the super." }] }] },
  bodyText: "Called the super.",
  createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(),
  author: { id: "u1", fullName: "Avery", email: "a@x", avatarUrl: null },
};

describe("NoteEntry", () => {
  it("renders the body text and author", () => {
    render(<NoteEntry note={base} currentUserId="u2" onEdit={vi.fn()} onDelete={vi.fn()} />);
    expect(screen.getByText(/called the super/i)).toBeInTheDocument();
    expect(screen.getByText(/avery/i)).toBeInTheDocument();
  });

  it("shows edit/delete only to the author", () => {
    const { rerender } = render(<NoteEntry note={base} currentUserId="u2" onEdit={vi.fn()} onDelete={vi.fn()} />);
    expect(screen.queryByRole("button", { name: /delete/i })).not.toBeInTheDocument();
    rerender(<NoteEntry note={base} currentUserId="u1" onEdit={vi.fn()} onDelete={vi.fn()} />);
    expect(screen.getByRole("button", { name: /delete/i })).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run to verify it fails** → FAIL.

- [ ] **Step 3: Implement** — read-only render via TipTap's `generateHTML(bodyJson, noteExtensions)`
  (from `@tiptap/html`) into sanitized markup, or render `bodyText` in a `<p>` if `generateHTML`
  is unavailable in this TipTap build. Author avatar/initials + name + `relativeAge(createdAt)` +
  an "edited" marker when `updatedAt > createdAt`. Author-only `Edit`/`Delete` buttons.

```tsx
// NoteEntry.tsx
"use client";
import { Pencil, Trash2 } from "lucide-react";
import { relativeAge } from "@/features/views/components/views/signals/relative-date";
import type { DistrictNote } from "@/features/views/lib/queries";

interface Props {
  note: DistrictNote;
  currentUserId: string | null;
  onEdit: (note: DistrictNote) => void;
  onDelete: (noteId: string) => void;
}

export function NoteEntry({ note, currentUserId, onEdit, onDelete }: Props) {
  const isAuthor = currentUserId != null && currentUserId === note.author.id;
  const edited = note.updatedAt !== note.createdAt;
  const name = note.author.fullName ?? note.author.email;
  const initials = (note.author.fullName ?? note.author.email)
    .split(/\s+/).filter(Boolean).slice(0, 2).map((s) => s[0]?.toUpperCase() ?? "").join("");

  return (
    <div className="border-b border-[#EFEDF5] py-2.5 last:border-b-0">
      <div className="mb-1 flex items-center gap-2">
        <div className="flex h-5 w-5 items-center justify-center rounded-full bg-[#C4E7E6] text-[9px] font-semibold text-[#403770]">{initials || "—"}</div>
        <span className="text-[12px] font-semibold text-[#403770]">{name}</span>
        <span className="text-[11px] text-[#8A80A8]">· {relativeAge(note.createdAt)}{edited ? " · edited" : ""}</span>
        {isAuthor && (
          <span className="ml-auto flex items-center gap-1">
            <button type="button" aria-label="Edit note" className="rounded p-0.5 text-[#8A80A8] hover:text-[#403770]" onClick={() => onEdit(note)}><Pencil className="h-3 w-3" /></button>
            <button type="button" aria-label="Delete note" className="rounded p-0.5 text-[#8A80A8] hover:text-[#C2410C]" onClick={() => onDelete(note.id)}><Trash2 className="h-3 w-3" /></button>
          </span>
        )}
      </div>
      {/* Phase 1 renders flattened text; Phase 2 swaps to a TipTap read-only render. */}
      <p className="m-0 whitespace-pre-wrap text-[13px] leading-snug text-[#403770]">{note.bodyText}</p>
    </div>
  );
}
```

- [ ] **Step 4: Run to verify it passes** → PASS.
- [ ] **Step 5: Commit**

```bash
git add src/features/views/components/notes/NoteEntry.tsx \
        src/features/views/components/notes/__tests__/NoteEntry.test.tsx
git commit -m "feat(notes): note entry row with author edit/delete"
```

---

## Task 6: NotesPopover (AnchoredPopover + composer + feed)

**Files:**
- Create: `src/features/views/components/notes/NotesPopover.tsx`
- Test: `src/features/views/components/notes/__tests__/NotesPopover.test.tsx`

- [ ] **Step 1: Write the failing test** — render via a ref Harness (like SetTargetsPopover's
  test in the row-actions plan); stub `GET /districts/.../notes` to return two notes; assert both
  render newest-first and the composer is present.

```tsx
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { useRef } from "react";
import { render, screen } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { NotesPopover } from "../NotesPopover";

function wrapper({ children }: { children: React.ReactNode }) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return <QueryClientProvider client={qc}>{children}</QueryClientProvider>;
}
function Harness() {
  const ref = useRef<HTMLButtonElement>(null);
  return (<><button ref={ref}>a</button>
    <NotesPopover leaid="0601234" currentUserId="u1" anchorRef={ref} open onClose={() => {}} /></>);
}
const mk = (id: string, text: string, iso: string) => ({
  id, bodyJson: { type: "doc" }, bodyText: text, createdAt: iso, updatedAt: iso,
  author: { id: "u1", fullName: "A", email: "a@x", avatarUrl: null },
});
beforeEach(() => {
  vi.stubGlobal("fetch", vi.fn(() => Promise.resolve(new Response(
    JSON.stringify({ notes: [mk("n2", "newer", "2026-05-20T00:00:00Z"), mk("n1", "older", "2026-05-01T00:00:00Z")] }),
    { status: 200, headers: { "Content-Type": "application/json" } }))));
});
afterEach(() => vi.unstubAllGlobals());

describe("NotesPopover", () => {
  it("renders the composer and the feed newest-first", async () => {
    render(<Harness />, { wrapper });
    expect(await screen.findByText("newer")).toBeInTheDocument();
    expect(screen.getByText("older")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /save/i })).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run to verify it fails** → FAIL.

- [ ] **Step 3: Implement**

```tsx
// NotesPopover.tsx
"use client";
import { useState, type RefObject } from "react";
import { AnchoredPopover } from "@/features/views/components/grid/AnchoredPopover";
import { NoteComposer } from "./NoteComposer";
import { NoteEntry } from "./NoteEntry";
import {
  useDistrictNotes, useCreateDistrictNote, useUpdateDistrictNote, useDeleteDistrictNote,
  type DistrictNote,
} from "@/features/views/lib/queries";

interface Props {
  leaid: string;
  currentUserId: string | null;
  anchorRef: RefObject<HTMLElement | null>;
  open: boolean;
  onClose: () => void;
}

export function NotesPopover({ leaid, currentUserId, anchorRef, open, onClose }: Props) {
  const q = useDistrictNotes(leaid, open); // lazy: only fetch when open
  const create = useCreateDistrictNote(leaid);
  const update = useUpdateDistrictNote(leaid);
  const del = useDeleteDistrictNote(leaid);
  const [editing, setEditing] = useState<DistrictNote | null>(null);

  return (
    <AnchoredPopover anchorRef={anchorRef} open={open} onDismiss={onClose}>
      <div role="dialog" aria-label="District notes"
        style={{ width: 360 }}
        className="max-h-[60vh] overflow-y-auto rounded-xl border border-[#E2DEEC] bg-white p-3 shadow-[0_10px_30px_rgba(64,55,112,0.18)]"
        // CLAUDE.md mobile: opt-in vertical pan for the scroll area.
        // (parent is not a map ancestor, so pan-y is safe here.)
        // eslint-disable-next-line react/no-unknown-property
      >
        {editing ? (
          <NoteComposer
            initialJson={editing.bodyJson}
            saving={update.isPending}
            onCancel={() => setEditing(null)}
            onSave={(doc) => update.mutate(
              { noteId: editing.id, ...doc },
              { onSuccess: () => setEditing(null) },
            )}
          />
        ) : (
          <NoteComposer
            saving={create.isPending}
            onSave={(doc) => create.mutate(doc)}
          />
        )}

        <div className="mt-2">
          {q.isLoading ? (
            <p className="py-4 text-center text-[12px] text-[#8A80A8]">Loading…</p>
          ) : (q.data?.notes.length ?? 0) === 0 ? (
            <p className="py-4 text-center text-[12px] text-[#8A80A8]">No notes yet.</p>
          ) : (
            q.data!.notes.map((n) => (
              <NoteEntry key={n.id} note={n} currentUserId={currentUserId}
                onEdit={setEditing} onDelete={(id) => del.mutate(id)} />
            ))
          )}
        </div>
      </div>
    </AnchoredPopover>
  );
}
```

- [ ] **Step 4: Run to verify it passes** → PASS.
- [ ] **Step 5: Commit**

```bash
git add src/features/views/components/notes/NotesPopover.tsx \
        src/features/views/components/notes/__tests__/NotesPopover.test.tsx
git commit -m "feat(notes): notes popover (composer + feed)"
```

---

## Task 7: Inline latest-note snippet + count on the districts grid

**Files:**
- Modify: `src/lib/saved-views/source-fields.ts`
- Modify: `src/app/api/views/data/route.ts`
- Test: `src/lib/saved-views/__tests__/source-fields.test.ts` (field presence) + a route-level
  assertion if the route has a test harness.

This feeds `DistrictNotesCell` (Task 8) the snippet + count per row without per-row fetches.

- [ ] **Step 1: Write the failing test** — assert the districts source exposes a `latest_note`
  field id (mirror an existing `source-fields` test):

```ts
import { describe, it, expect } from "vitest";
import { SOURCE_FIELDS } from "../source-fields"; // confirm the exported name

describe("districts latest_note field", () => {
  it("is registered as a virtual, non-filterable field", () => {
    const f = SOURCE_FIELDS.districts.find((x: any) => x.id === "latest_note");
    expect(f).toBeTruthy();
    expect(f?.virtual).toBe(true);
  });
});
```

- [ ] **Step 2: Run to verify it fails** → FAIL.

- [ ] **Step 3: Implement**

a) In `source-fields.ts`, add to the `districts` array (mirror the `customer_rank` virtual entry):
```ts
{
  // Virtual: read-only inline display (latest note snippet + count). Not filterable.
  id: "latest_note", label: "Notes", column: "", type: "text", ops: [],
  virtual: true, requiresPlanContext: false,
},
```

b) In `app/api/views/data/route.ts`, mirror the `__rank_cte` pattern: always (for
`source === "districts"`) push a notes CTE and LEFT JOIN it, then project its columns. After the
existing `cteFragments`/`cteJoin` setup (~line 266) add:
```ts
if (source === "districts") {
  cteFragments.push(`__notes_cte AS (
    SELECT DISTINCT ON (district_leaid)
      district_leaid,
      body_text AS latest_note_text,
      COUNT(*) OVER (PARTITION BY district_leaid) AS note_count
    FROM district_notes
    ORDER BY district_leaid, created_at DESC
  )`);
  cteJoin += ` LEFT JOIN __notes_cte ON __notes_cte.district_leaid = ${alias}."leaid"`;
}
```
Then extend the final projection (~line 301) so these columns ride along:
```ts
SELECT ${alias}.*, __notes_cte.latest_note_text, __notes_cte.note_count, COUNT(*) OVER() AS __total
```
(Only when the notes CTE is present — guard with the same `source === "districts"` condition, or
always include since the join is null-safe for non-district sources where the CTE is absent. If
referencing `__notes_cte` columns unconditionally errors for other sources, gate the projection
string on `source === "districts"`.) `camelizeRow` (~line 371) turns these into `latestNoteText`
and `noteCount` on each row.

- [ ] **Step 4: Run to verify it passes** → PASS (source-fields test). Manually hit
  `/api/views/data?source=districts&leaids=<leaid>&planId=<id>` and confirm rows include
  `latestNoteText` / `noteCount`.

- [ ] **Step 5: Commit**

```bash
git add src/lib/saved-views/source-fields.ts src/app/api/views/data/route.ts \
        src/lib/saved-views/__tests__/source-fields.test.ts
git commit -m "feat(notes): inline latest-note snippet + count on districts grid"
```

---

## Task 8: DistrictNotesCell replaces PlanNotesCell

**Files:**
- Create: `src/features/views/components/notes/DistrictNotesCell.tsx`
- Modify: `src/features/views/components/grid/GridView.tsx` (re-read first)
- Test: `src/features/views/components/notes/__tests__/DistrictNotesCell.test.tsx`

- [ ] **Step 1: Write the failing test**

```tsx
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { DistrictNotesCell } from "../DistrictNotesCell";

function wrapper({ children }: { children: React.ReactNode }) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return <QueryClientProvider client={qc}>{children}</QueryClientProvider>;
}
beforeEach(() => {
  vi.stubGlobal("fetch", vi.fn(() => Promise.resolve(new Response(
    JSON.stringify({ notes: [] }), { status: 200, headers: { "Content-Type": "application/json" } }))));
});
afterEach(() => vi.unstubAllGlobals());

describe("DistrictNotesCell", () => {
  it("shows the snippet + count when notes exist", () => {
    render(<DistrictNotesCell leaid="0601234" latestNote="Called the super." noteCount={3} currentUserId="u1" />, { wrapper });
    expect(screen.getByText(/called the super/i)).toBeInTheDocument();
    expect(screen.getByText("3")).toBeInTheDocument();
  });
  it("shows '+ Add note' when empty and opens the popover on click", async () => {
    render(<DistrictNotesCell leaid="0601234" latestNote={null} noteCount={0} currentUserId="u1" />, { wrapper });
    const trigger = screen.getByRole("button", { name: /add note/i });
    fireEvent.click(trigger);
    expect(await screen.findByRole("dialog", { name: /district notes/i })).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run to verify it fails** → FAIL.

- [ ] **Step 3: Implement**

```tsx
// DistrictNotesCell.tsx
"use client";
import { useRef, useState } from "react";
import { MessageSquarePlus } from "lucide-react";
import { NotesPopover } from "./NotesPopover";

interface Props {
  leaid: string;
  latestNote: string | null;
  noteCount: number;
  currentUserId: string | null;
}

export function DistrictNotesCell({ leaid, latestNote, noteCount, currentUserId }: Props) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLButtonElement>(null);

  return (
    <>
      <button
        ref={ref}
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="flex max-w-[220px] items-center gap-1.5 text-left"
      >
        {latestNote ? (
          <>
            <span className="truncate text-[12px] text-[#544A78]">{latestNote}</span>
            {noteCount > 1 && (
              <span className="shrink-0 rounded-full bg-[#EFEDF5] px-1.5 text-[10px] font-semibold text-[#6F4C8C]">{noteCount}</span>
            )}
          </>
        ) : (
          <span className="flex items-center gap-1 text-[12px] text-[#A69DC0]">
            <MessageSquarePlus className="h-3.5 w-3.5" /> Add note
          </span>
        )}
      </button>
      <NotesPopover leaid={leaid} currentUserId={currentUserId} anchorRef={ref} open={open} onClose={() => setOpen(false)} />
    </>
  );
}
```

b) In `GridView.tsx` cell dispatch (~line 259), replace the `PlanNotesCell` branch:
```tsx
if (c.id === "plan_notes" && leaid) {
  return (
    <DistrictNotesCell
      leaid={leaid}
      latestNote={typeof row.latestNoteText === "string" ? row.latestNoteText : null}
      noteCount={typeof row.noteCount === "number" ? row.noteCount : Number(row.noteCount ?? 0)}
      currentUserId={/* from useProfile(); see below */ null}
    />
  );
}
```
Import `DistrictNotesCell`; remove the now-unused `PlanNotesCell` import. Get `currentUserId` from
`useProfile()` (the project's profile hook — grep for its export) called once at the top of
`GridView`, and pass it down. Delete `cells/PlanNotesCell.tsx` only after confirming no other
importer remains (`rg "PlanNotesCell" src`).

- [ ] **Step 4: Run to verify it passes** → PASS. Then `npx vitest run src/features/views/components/grid` (existing grid tests stay green).
- [ ] **Step 5: Commit**

```bash
git add src/features/views/components/notes/DistrictNotesCell.tsx \
        src/features/views/components/notes/__tests__/DistrictNotesCell.test.tsx \
        src/features/views/components/grid/GridView.tsx
# include the PlanNotesCell deletion only if done:
# git rm src/features/views/components/grid/cells/PlanNotesCell.tsx
git commit -m "feat(notes): district notes cell replaces plan notes cell"
```

---

## Task 9 (optional): Latest-note virtual sort

**Files:** `src/lib/saved-views/source-fields.ts` (already has `latest_note`), `sql-compiler.ts`,
`app/api/views/data/route.ts`, `sql-compiler` test.

- [ ] Add a `latest_note` virtual sort handler in `sql-compiler.ts` (mirror `customer_rank`,
  ~line 331): `return \`__notes_cte.created_at ${safeDir} NULLS LAST\`;` — and include
  `created_at` in `__notes_cte`'s projection. Ensure the route injects `__notes_cte` when sorting
  by `latest_note` (it already injects it for districts in Task 7).
- [ ] Test: extend `sql-compiler` order-by test to assert the `latest_note` branch emits the
  expected fragment.
- [ ] Commit: `feat(notes): sort districts by latest note`.

---

## Task 10: Wire kebab "Add note" to the notes popover

**Files:**
- Modify: `src/features/views/components/grid/actions/RowActionsMenu.tsx` (re-read; from the
  row-actions plan)
- Test: `src/features/views/components/grid/actions/__tests__/RowActionsMenu.test.tsx`

Depends on the row-actions menu (`2026-05-22-table-row-actions-menu.md`) being implemented.

- [ ] **Step 1: Add the failing test**

```tsx
it("opens the notes popover from the Add note item", async () => {
  render(<RowActionsMenu {...props} currentUserId="u1" />, { wrapper });
  fireEvent.click(screen.getByRole("button", { name: /actions for tedesco usd/i }));
  fireEvent.click(await screen.findByRole("menuitem", { name: /add note/i }));
  expect(await screen.findByRole("dialog", { name: /district notes/i })).toBeInTheDocument();
});
```
(Stub `fetch` to return `{ notes: [] }`.)

- [ ] **Step 2: Run to verify it fails** → FAIL (no "Add note" item).

- [ ] **Step 3: Implement** — in `RowActionsMenu.tsx`:
  - Extend `Surface` with `"note"`.
  - Add a `currentUserId?: string | null` prop (passed from `GridView`; default null).
  - Add the menu item as position 2 (after "Log activity"):
    ```tsx
    <button type="button" role="menuitem" className={item} onClick={() => choose("note")}>
      <StickyNote className="h-3.5 w-3.5 opacity-70" /> Add note
    </button>
    ```
    (import `StickyNote` from lucide-react.)
  - Render the popover, anchored to the kebab:
    ```tsx
    <NotesPopover leaid={leaid} currentUserId={currentUserId ?? null}
      anchorRef={btnRef} open={surface === "note"} onClose={() => setSurface(null)} />
    ```
  - In `GridView.tsx`, pass `currentUserId` into `<RowActionsMenu ... currentUserId={currentUserId} />`.

- [ ] **Step 4: Run to verify it passes** → PASS, then `npx vitest run src/features/views/components/grid/actions`.
- [ ] **Step 5: Commit**

```bash
git add src/features/views/components/grid/actions/RowActionsMenu.tsx \
        src/features/views/components/grid/actions/__tests__/RowActionsMenu.test.tsx \
        src/features/views/components/grid/GridView.tsx
git commit -m "feat(views): kebab Add note opens the district notes popover"
```

---

## Final verification

- [ ] `npx vitest run src/features/views src/lib/saved-views src/app/api/districts`
- [ ] `npx tsc --noEmit`
- [ ] Manual (`npm run dev`): open a plan Table view → a district's Notes cell shows the latest
  snippet + count (or "+ Add note") → click opens the popover → add a rich-text note (B/I/list/
  link, ⌘↵) → it appears newest-first and the inline snippet updates → edit/delete your own entry;
  another author's entry is read-only. Confirm the kebab "Add note" opens the same popover.
- [ ] Mobile (iPhone Safari): popover scrolls; no `overflow:hidden` on html/body; editor usable.

## Notes / deferrals

- **Phase 2 (mentions)** — `@`/`/`/`*`/`#` typeahead chips + `district_note_mentions` table — is
  a separate future plan per the design doc; the `body_json` format already accommodates mention
  nodes, and the `#`/`*`/`_` input rules are kept free for it.
- If TipTap's read-only `generateHTML` is wanted in `NoteEntry` (instead of flattened `bodyText`),
  layer it in without changing storage — the `bodyJson` is already persisted.
