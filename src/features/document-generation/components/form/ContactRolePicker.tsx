"use client";
import { useState } from "react";
import { Plus } from "lucide-react";
import { useDistrictContacts } from "@/features/document-generation/lib/queries";
import { useCreateContact } from "@/features/shared/lib/queries";
import type { ContactRef } from "@/features/document-generation/lib/payload-types";

function splitName(name: string) {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  return { first: parts[0] ?? "", last: parts.slice(1).join(" ") };
}

/**
 * Map a contacts-list item (`ContactListItem`, no salutation) or a freshly
 * created `Contact` (has salutation) into the document's `ContactRef` shape.
 */
function toRef(c: {
  id: number;
  name: string;
  salutation?: string | null;
  title?: string | null;
  email?: string | null;
  phone?: string | null;
}): ContactRef {
  const { first, last } = splitName(c.name);
  return {
    contactId: c.id,
    salutation: c.salutation ?? null,
    firstName: first,
    lastName: last,
    title: c.title ?? null,
    email: c.email ?? null,
    phone: c.phone ?? null,
  };
}

const NEW_CONTACT_FIELDS = ["salutation", "name", "title", "email", "phone"] as const;

interface Props {
  label: string;
  leaid: string;
  value: ContactRef | null;
  onChange: (c: ContactRef) => void;
}

export default function ContactRolePicker({ label, leaid, value, onChange }: Props) {
  const { data } = useDistrictContacts(leaid);
  const createContact = useCreateContact();
  const [adding, setAdding] = useState(false);
  const [form, setForm] = useState({ salutation: "", name: "", title: "", email: "", phone: "" });
  const [error, setError] = useState<string | null>(null);

  // data?.contacts is ContactListItem[] — list items carry no salutation.
  const contacts = data?.contacts ?? [];

  async function handleCreate() {
    setError(null);
    try {
      const created = await createContact.mutateAsync({
        leaid,
        name: form.name,
        salutation: form.salutation || undefined,
        title: form.title || undefined,
        email: form.email || undefined,
        phone: form.phone || undefined,
      });
      onChange(toRef(created)); // auto-select the newly created contact into this role
      setAdding(false);
      setForm({ salutation: "", name: "", title: "", email: "", phone: "" });
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to create contact");
    }
  }

  return (
    <div className="space-y-1">
      <div className="text-xs uppercase tracking-wide text-[#6B4E9E] whitespace-nowrap">{label}</div>
      <div className="flex flex-wrap gap-1">
        {contacts.map((c) => (
          <button
            key={c.id}
            type="button"
            onClick={() => onChange(toRef(c))}
            className={`rounded-lg px-2 py-1 text-sm whitespace-nowrap ${
              value?.contactId === c.id ? "bg-[#6B4E9E] text-white" : "bg-[#EFEDF5]"
            }`}
          >
            {c.name}
            {c.title ? ` — ${c.title}` : ""}
          </button>
        ))}
        <button
          type="button"
          onClick={() => setAdding((a) => !a)}
          className="flex items-center gap-1 rounded-lg border border-[#EFEDF5] px-2 py-1 text-sm whitespace-nowrap"
        >
          <Plus size={14} /> Add new
        </button>
      </div>
      {adding && (
        <div className="space-y-1 rounded-lg bg-[#F7F5FA] p-2">
          {NEW_CONTACT_FIELDS.map((f) => (
            <input
              key={f}
              aria-label={f}
              placeholder={f}
              value={form[f]}
              onChange={(e) => setForm((s) => ({ ...s, [f]: e.target.value }))}
              className="w-full rounded border border-[#EFEDF5] px-2 py-1 text-sm"
            />
          ))}
          {error && <p className="text-sm text-[#c44]">{error}</p>}
          <button
            type="button"
            onClick={handleCreate}
            disabled={!form.name || createContact.isPending}
            className="rounded-lg bg-[#6B4E9E] px-3 py-1 text-sm text-white disabled:opacity-50"
          >
            Save contact
          </button>
        </div>
      )}
    </div>
  );
}
