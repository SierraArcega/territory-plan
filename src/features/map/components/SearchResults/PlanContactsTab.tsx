"use client";

import { useState, useCallback } from "react";
import { usePlanContacts } from "@/lib/api";
import { useCreateContact, useUpdateContact } from "@/features/shared/lib/queries";
import type { Contact } from "@/features/shared/types/api-types";
import { PERSONAS, SENIORITY_LEVELS } from "@/features/shared/types/contact-types";

interface PlanContactsTabProps {
  planId: string;
  districts?: { leaid: string; name: string }[];
}

interface ContactFormData {
  salutation: string;
  name: string;
  title: string;
  email: string;
  phone: string;
  isPrimary: boolean;
  linkedinUrl: string;
  persona: string;
  seniorityLevel: string;
}

const emptyForm: ContactFormData = {
  salutation: "",
  name: "",
  title: "",
  email: "",
  phone: "",
  isPrimary: false,
  linkedinUrl: "",
  persona: "",
  seniorityLevel: "",
};

function contactToForm(c: Contact): ContactFormData {
  return {
    salutation: c.salutation ?? "",
    name: c.name,
    title: c.title ?? "",
    email: c.email ?? "",
    phone: c.phone ?? "",
    isPrimary: c.isPrimary,
    linkedinUrl: c.linkedinUrl ?? "",
    persona: c.persona ?? "",
    seniorityLevel: c.seniorityLevel ?? "",
  };
}

export default function PlanContactsTab({ planId, districts = [] }: PlanContactsTabProps) {
  const { data: contacts, isLoading } = usePlanContacts(planId);
  const createContact = useCreateContact();
  const updateContact = useUpdateContact();

  const [isAdding, setIsAdding] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [formData, setFormData] = useState<ContactFormData>(emptyForm);
  const [selectedLeaid, setSelectedLeaid] = useState<string>(districts[0]?.leaid ?? "");

  const handleSaveNew = useCallback(() => {
    if (!formData.name.trim() || !selectedLeaid) return;
    createContact.mutate(
      {
        leaid: selectedLeaid,
        name: formData.name.trim(),
        salutation: formData.salutation || null,
        title: formData.title || null,
        email: formData.email || null,
        phone: formData.phone || null,
        isPrimary: formData.isPrimary,
        linkedinUrl: formData.linkedinUrl || null,
        persona: formData.persona || null,
        seniorityLevel: formData.seniorityLevel || null,
      },
      {
        onSuccess: () => {
          setIsAdding(false);
          setFormData(emptyForm);
        },
      }
    );
  }, [formData, selectedLeaid, createContact]);

  const handleSaveEdit = useCallback(() => {
    if (!formData.name.trim() || editingId == null) return;
    const contact = contacts?.find((c) => c.id === editingId);
    if (!contact) return;
    updateContact.mutate(
      {
        id: editingId,
        leaid: contact.leaid,
        name: formData.name.trim(),
        salutation: formData.salutation || null,
        title: formData.title || null,
        email: formData.email || null,
        phone: formData.phone || null,
        isPrimary: formData.isPrimary,
        linkedinUrl: formData.linkedinUrl || null,
        persona: formData.persona || null,
        seniorityLevel: formData.seniorityLevel || null,
      },
      {
        onSuccess: () => {
          setEditingId(null);
          setFormData(emptyForm);
        },
      }
    );
  }, [formData, editingId, contacts, updateContact]);

  const startEdit = (contact: Contact) => {
    setEditingId(contact.id);
    setFormData(contactToForm(contact));
    setIsAdding(false);
  };

  const startAdd = () => {
    setIsAdding(true);
    setEditingId(null);
    setFormData(emptyForm);
    setSelectedLeaid(districts[0]?.leaid ?? "");
  };

  const cancelForm = () => {
    setIsAdding(false);
    setEditingId(null);
    setFormData(emptyForm);
  };

  if (isLoading) {
    return (
      <div className="p-5 space-y-3 animate-pulse">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="flex items-center gap-3 p-3 rounded-lg border border-[#f0edf5]">
            <div className="w-9 h-9 rounded-full bg-[#f0edf5]" />
            <div className="flex-1 space-y-1.5">
              <div className="h-3 bg-[#f0edf5] rounded w-1/3" />
              <div className="h-2.5 bg-[#f0edf5] rounded w-1/2" />
            </div>
          </div>
        ))}
      </div>
    );
  }

  if (!contacts || (contacts.length === 0 && !isAdding)) {
    return (
      <div className="flex flex-col items-center justify-center py-20 px-6 text-center">
        <svg className="w-9 h-9 text-[#C2BBD4] mb-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 19.128a9.38 9.38 0 002.625.372 9.337 9.337 0 004.121-.952 4.125 4.125 0 00-7.533-2.493M15 19.128v-.003c0-1.113-.285-2.16-.786-3.07M15 19.128v.106A12.318 12.318 0 018.624 21c-2.331 0-4.512-.645-6.374-1.766l-.001-.109a6.375 6.375 0 0111.964-3.07M12 6.375a3.375 3.375 0 11-6.75 0 3.375 3.375 0 016.75 0zm8.25 2.25a2.625 2.625 0 11-5.25 0 2.625 2.625 0 015.25 0z" />
        </svg>
        <p className="text-sm font-medium text-[#6E6390]">No contacts yet</p>
        <p className="text-xs text-[#A69DC0] mt-1">Contacts from districts in this plan will appear here.</p>
        {districts.length > 0 && (
          <button
            onClick={startAdd}
            className="mt-3 px-3 py-1.5 rounded-lg text-xs font-semibold text-white bg-[#403770] hover:bg-[#544A78] transition-colors"
          >
            + Add Contact
          </button>
        )}
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full">
      <div className="flex-1 overflow-y-auto p-5 space-y-2">
        {contacts.map((contact) =>
          editingId === contact.id ? (
            <ContactInlineForm
              key={contact.id}
              formData={formData}
              setFormData={setFormData}
              onSave={handleSaveEdit}
              onCancel={cancelForm}
              isPending={updateContact.isPending}
              isEditing
            />
          ) : (
            <div
              key={contact.id}
              onClick={() => startEdit(contact)}
              className="flex items-center gap-3 p-3 rounded-lg border border-[#E2DEEC] hover:border-[#D4CFE2] hover:bg-[#FAFAFE] transition-colors cursor-pointer group"
            >
              {/* Avatar */}
              <div className="w-9 h-9 rounded-full bg-[#f0edf5] flex items-center justify-center shrink-0">
                <span className="text-xs font-bold text-[#8A80A8]">
                  {(contact.name ?? "?").charAt(0).toUpperCase()}
                </span>
              </div>

              {/* Info */}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-semibold text-[#544A78] truncate group-hover:text-[#403770]">
                    {contact.name}
                  </span>
                  {contact.isPrimary && (
                    <span className="px-1.5 py-0.5 rounded text-[9px] font-bold uppercase bg-[#403770]/8 text-[#403770]">
                      Primary
                    </span>
                  )}
                </div>
                {contact.title && (
                  <p className="text-[11px] text-[#8A80A8] truncate mt-0.5">{contact.title}</p>
                )}
                {(contact.persona || contact.seniorityLevel) && (
                  <p className="text-[10px] text-[#A69DC0] truncate mt-0.5">
                    {[contact.seniorityLevel, contact.persona].filter(Boolean).join(" · ")}
                  </p>
                )}
              </div>

              {/* Actions */}
              <div className="flex items-center gap-1.5 shrink-0" onClick={(e) => e.stopPropagation()}>
                {contact.email && (
                  <a
                    href={`mailto:${contact.email}`}
                    className="w-7 h-7 rounded-lg hover:bg-[#f0edf5] flex items-center justify-center text-[#A69DC0] hover:text-[#6E6390] transition-colors"
                    title={contact.email}
                  >
                    <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
                      <rect x="1" y="2.5" width="10" height="7" rx="1.5" stroke="currentColor" strokeWidth="1.2" />
                      <path d="M1.5 3L6 6.5L10.5 3" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                  </a>
                )}
                {contact.phone && (
                  <a
                    href={`tel:${contact.phone}`}
                    className="w-7 h-7 rounded-lg hover:bg-[#f0edf5] flex items-center justify-center text-[#A69DC0] hover:text-[#6E6390] transition-colors"
                    title={contact.phone}
                  >
                    <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
                      <path d="M3.5 1.5L5 4L3.5 5C4.2 6.5 5.5 7.8 7 8.5L8 7L10.5 8.5V10C10.5 10.3 10.3 10.5 10 10.5C5.3 10.2 1.8 6.7 1.5 2C1.5 1.7 1.7 1.5 2 1.5H3.5Z" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                  </a>
                )}
              </div>
            </div>
          )
        )}

        {/* Add form at bottom of list */}
        {isAdding && (
          <div className="space-y-2">
            {/* District picker */}
            {districts.length > 1 && (
              <div>
                <label className="text-[9px] font-bold uppercase tracking-wider text-[#A69DC0]">District</label>
                <select
                  value={selectedLeaid}
                  onChange={(e) => setSelectedLeaid(e.target.value)}
                  className="mt-0.5 w-full px-2 py-1.5 text-xs border border-[#E2DEEC] rounded-lg bg-white text-[#544A78] focus:outline-none focus:ring-2 focus:ring-[#403770]/20 focus:border-[#403770]"
                >
                  {districts.map((d) => (
                    <option key={d.leaid} value={d.leaid}>{d.name}</option>
                  ))}
                </select>
              </div>
            )}
            <ContactInlineForm
              formData={formData}
              setFormData={setFormData}
              onSave={handleSaveNew}
              onCancel={cancelForm}
              isPending={createContact.isPending}
            />
          </div>
        )}
      </div>

      {/* Footer */}
      <div className="shrink-0 border-t border-[#E2DEEC] px-5 py-3 flex items-center justify-between bg-[#FAFAFE]">
        {districts.length > 0 && !isAdding ? (
          <button
            onClick={startAdd}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold text-white bg-[#403770] hover:bg-[#544A78] transition-colors"
          >
            <svg width="10" height="10" viewBox="0 0 10 10" fill="none">
              <path d="M5 1V9M1 5H9" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
            </svg>
            Add Contact
          </button>
        ) : (
          <span />
        )}
        <span className="text-[11px] text-[#A69DC0]">
          {contacts.length} contact{contacts.length !== 1 ? "s" : ""}
        </span>
      </div>
    </div>
  );
}

// ─── Inline Contact Form ────────────────────────────────────────

function ContactInlineForm({
  formData,
  setFormData,
  onSave,
  onCancel,
  isPending,
  isEditing,
}: {
  formData: ContactFormData;
  setFormData: (data: ContactFormData) => void;
  onSave: () => void;
  onCancel: () => void;
  isPending: boolean;
  isEditing?: boolean;
}) {
  const inputClass =
    "w-full px-2.5 py-1.5 text-xs border border-[#E2DEEC] rounded-lg bg-white text-[#544A78] placeholder:text-[#C2BBD4] focus:outline-none focus:ring-2 focus:ring-[#403770]/20 focus:border-[#403770] transition-colors";
  const selectClass =
    "flex-1 px-2.5 py-1.5 text-xs border border-[#E2DEEC] rounded-lg bg-white text-[#544A78] focus:outline-none focus:ring-2 focus:ring-[#403770]/20 focus:border-[#403770] transition-colors";

  return (
    <div className="p-3 rounded-lg border-2 border-dashed border-[#C4E7E6] bg-[#C4E7E6]/10 space-y-2">
      <div className="text-[9px] font-bold uppercase tracking-wider text-[#6EA3BE] mb-1">
        {isEditing ? "Edit Contact" : "New Contact"}
      </div>
      <div className="flex gap-2">
        <input
          type="text"
          value={formData.salutation}
          onChange={(e) => setFormData({ ...formData, salutation: e.target.value })}
          placeholder="Mr./Ms."
          className={`${inputClass} !w-20`}
        />
        <input
          type="text"
          value={formData.name}
          onChange={(e) => setFormData({ ...formData, name: e.target.value })}
          placeholder="Name *"
          className={`${inputClass} flex-1`}
        />
      </div>
      <input
        type="text"
        value={formData.title}
        onChange={(e) => setFormData({ ...formData, title: e.target.value })}
        placeholder="Job Title"
        className={inputClass}
      />
      <div className="flex gap-2">
        <input
          type="email"
          value={formData.email}
          onChange={(e) => setFormData({ ...formData, email: e.target.value })}
          placeholder="Email"
          className={`${inputClass} flex-1`}
        />
        <input
          type="tel"
          value={formData.phone}
          onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
          placeholder="Phone"
          className={`${inputClass} flex-1`}
        />
      </div>
      <input
        type="url"
        value={formData.linkedinUrl}
        onChange={(e) => setFormData({ ...formData, linkedinUrl: e.target.value })}
        placeholder="LinkedIn URL"
        className={inputClass}
      />
      <div className="flex gap-2">
        <select
          value={formData.persona}
          onChange={(e) => setFormData({ ...formData, persona: e.target.value })}
          className={selectClass}
        >
          <option value="">Department...</option>
          {PERSONAS.map((p) => (
            <option key={p} value={p}>{p}</option>
          ))}
        </select>
        <select
          value={formData.seniorityLevel}
          onChange={(e) => setFormData({ ...formData, seniorityLevel: e.target.value })}
          className={selectClass}
        >
          <option value="">Seniority...</option>
          {SENIORITY_LEVELS.map((s) => (
            <option key={s} value={s}>{s}</option>
          ))}
        </select>
      </div>
      <div className="flex items-center justify-between pt-1">
        <label className="flex items-center gap-2 text-xs text-[#6E6390]">
          <input
            type="checkbox"
            checked={formData.isPrimary}
            onChange={(e) => setFormData({ ...formData, isPrimary: e.target.checked })}
            className="rounded border-[#E2DEEC] text-[#403770] focus:ring-[#403770]/30"
          />
          Primary contact
        </label>
        <div className="flex gap-2">
          <button
            onClick={onCancel}
            className="px-3 py-1.5 text-xs text-[#8A80A8] hover:text-[#544A78] transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={onSave}
            disabled={!formData.name.trim() || isPending}
            className="px-3 py-1.5 rounded-lg text-xs font-semibold text-white bg-[#403770] hover:bg-[#544A78] disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {isPending ? "Saving..." : "Save"}
          </button>
        </div>
      </div>
    </div>
  );
}
