"use client";
import { useMemo, useRef, useState } from "react";
import { ChevronDown, Plus } from "lucide-react";
import { useDistrictContacts } from "@/features/document-generation/lib/queries";
import { useCreateContact } from "@/features/shared/lib/queries";
import { useOutsideClick } from "@/features/shared/lib/use-outside-click";
import { splitFullName } from "@/features/document-generation/lib/name";
import type { ContactRef } from "@/features/document-generation/lib/payload-types";

function toRef(c: { id: number; name: string; salutation?: string | null; title?: string | null; email?: string | null; phone?: string | null }): ContactRef {
  const { first, last } = splitFullName(c.name);
  return { contactId: c.id, salutation: c.salutation ?? null, firstName: first, lastName: last, title: c.title ?? null, email: c.email ?? null, phone: c.phone ?? null };
}
const NEW_CONTACT_FIELDS = ["salutation", "name", "title", "email", "phone"] as const;

interface Props { label: string; leaid: string; value: ContactRef | null; onChange: (c: ContactRef) => void; }

export default function ContactRolePicker({ label, leaid, value, onChange }: Props) {
  const { data, isLoading } = useDistrictContacts(leaid);
  const createContact = useCreateContact();
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const [adding, setAdding] = useState(false);
  const [form, setForm] = useState({ salutation: "", name: "", title: "", email: "", phone: "" });
  const [error, setError] = useState<string | null>(null);
  const ref = useRef<HTMLDivElement>(null);

  const contacts = useMemo(() => data?.contacts ?? [], [data]);
  const filtered = useMemo(
    () => contacts.filter((c) => `${c.name} ${c.title ?? ""}`.toLowerCase().includes(query.toLowerCase())),
    [contacts, query],
  );

  useOutsideClick(ref, () => setOpen(false), open);

  const selectedLabel = value
    ? `${value.salutation ? value.salutation + " " : ""}${value.firstName} ${value.lastName}`.trim() + (value.title ? ` — ${value.title}` : "")
    : "";

  async function handleCreate() {
    setError(null);
    try {
      const created = await createContact.mutateAsync({
        leaid, name: form.name, salutation: form.salutation || undefined,
        title: form.title || undefined, email: form.email || undefined, phone: form.phone || undefined,
      });
      onChange(toRef(created));
      setAdding(false); setOpen(false);
      setForm({ salutation: "", name: "", title: "", email: "", phone: "" });
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to create contact");
    }
  }

  return (
    <div ref={ref} className="space-y-1">
      <div className="text-xs uppercase tracking-wide text-[#403770] whitespace-nowrap">{label}</div>
      {value && <div className="text-sm text-[#403770]">{selectedLabel}</div>}
      <div className="relative flex items-center gap-1">
        <div className="flex flex-1 items-center rounded border border-[#C2BBD4]">
          <input aria-label={label} value={query}
            onChange={(e) => { setQuery(e.target.value); setOpen(true); }}
            onFocus={() => setOpen(true)}
            onKeyDown={(e) => { if (e.key === "Escape") setOpen(false); }}
            placeholder={value ? "Change contact…" : "Search or select a contact…"}
            className="h-8 w-full rounded-l px-2 py-1 text-sm outline-none" />
          <button type="button" aria-label="Browse contacts" onClick={() => setOpen((o) => !o)} className="px-2 text-[#6E6390]">
            <ChevronDown size={16} />
          </button>
        </div>
        <button type="button" onClick={() => setAdding((a) => !a)}
          className="flex items-center gap-1 rounded-lg border border-[#EFEDF5] px-2 py-1 text-sm whitespace-nowrap">
          <Plus size={14} /> Add new
        </button>
        {open && (
          <div className="absolute left-0 top-9 z-10 max-h-48 w-full overflow-y-auto rounded border border-[#C2BBD4] bg-white shadow-lg">
            {filtered.length === 0 ? (
              <div className="px-2 py-1 text-sm text-[#6E6390]">
                {isLoading
                  ? "Loading contacts…"
                  : contacts.length === 0
                    ? "No contacts on file for this district — use ＋ Add new"
                    : "No matches for your search"}
              </div>
            ) : (
              filtered.map((c) => (
                <button key={c.id} type="button" onMouseDown={(e) => e.preventDefault()}
                  onClick={() => { onChange(toRef(c)); setQuery(""); setOpen(false); }}
                  className="block w-full px-2 py-1 text-left text-sm hover:bg-[#EFEDF5] whitespace-nowrap">
                  {c.name}{c.title ? ` — ${c.title}` : ""}
                </button>
              ))
            )}
          </div>
        )}
      </div>
      {adding && (
        <div className="space-y-1 rounded-lg bg-[#F7F5FA] p-2">
          {NEW_CONTACT_FIELDS.map((f) => (
            <input key={f} aria-label={f} placeholder={f} value={form[f]}
              onChange={(e) => setForm((s) => ({ ...s, [f]: e.target.value }))}
              className="w-full rounded border border-[#C2BBD4] px-2 py-1 text-sm" />
          ))}
          {error && <p className="text-sm text-[#F37167]">{error}</p>}
          <button type="button" onClick={handleCreate} disabled={!form.name || createContact.isPending}
            className="rounded-lg bg-[#403770] px-3 py-1 text-sm text-white disabled:opacity-50">
            Save contact
          </button>
        </div>
      )}
    </div>
  );
}
