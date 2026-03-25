"use client";

import { useState, useCallback, useMemo } from "react";
import { usePlanContacts, useDistrictWebsites } from "@/lib/api";
import { useCreateContact, useUpdateContact } from "@/features/shared/lib/queries";
import type { Contact } from "@/features/shared/types/api-types";
import { PERSONAS, SENIORITY_LEVELS } from "@/features/shared/types/contact-types";
import ContactsActionBar from "@/features/plans/components/ContactsActionBar";

// ─── Types ──────────────────────────────────────────────────────

interface PlanContactsTabProps {
  planId: string;
  planName?: string;
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

interface DistrictGroup {
  leaid: string;
  name: string;
  contacts: Contact[];
  departments: string[];
  primaryCount: number;
}

// ─── Main Component ─────────────────────────────────────────────

export default function PlanContactsTab({ planId, planName, districts = [] }: PlanContactsTabProps) {
  const [isEnriching, setIsEnriching] = useState(false);
  const { data: contacts, isLoading } = usePlanContacts(planId, {
    refetchInterval: isEnriching ? 5000 : false,
  });
  const createContact = useCreateContact();
  const updateContact = useUpdateContact();

  const [expandedDistrict, setExpandedDistrict] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [isAdding, setIsAdding] = useState(false);
  const [addingToLeaid, setAddingToLeaid] = useState<string | null>(null);
  const [formData, setFormData] = useState<ContactFormData>(emptyForm);

  // Build district name lookup from both districts prop and contact data
  const districtNameMap = useMemo(() => {
    const map = new Map<string, string>();
    for (const d of districts) map.set(d.leaid, d.name);
    return map;
  }, [districts]);

  const allDistrictLeaids = useMemo(() => districts.map((d) => d.leaid), [districts]);
  const { data: districtWebsiteMap } = useDistrictWebsites(allDistrictLeaids);

  // Group contacts by district, then track departments
  const districtGroups = useMemo(() => {
    if (!contacts) return [];
    const map = new Map<string, DistrictGroup>();
    for (const c of contacts) {
      let group = map.get(c.leaid);
      if (!group) {
        group = {
          leaid: c.leaid,
          name: districtNameMap.get(c.leaid) ?? c.leaid,
          contacts: [],
          departments: [],
          primaryCount: 0,
        };
        map.set(c.leaid, group);
      }
      group.contacts.push(c);
      if (c.isPrimary) group.primaryCount++;
    }
    // Also add districts with zero contacts so user can add to them
    for (const d of districts) {
      if (!map.has(d.leaid)) {
        map.set(d.leaid, {
          leaid: d.leaid,
          name: d.name,
          contacts: [],
          departments: [],
          primaryCount: 0,
        });
      }
    }
    // Compute unique departments per group
    for (const group of map.values()) {
      const depts = new Set(group.contacts.map((c) => c.persona ?? "Unassigned"));
      group.departments = [...depts].sort();
    }
    return [...map.values()].sort((a, b) => a.name.localeCompare(b.name));
  }, [contacts, districts, districtNameMap]);

  const handleSaveNew = useCallback(() => {
    if (!formData.name.trim() || !addingToLeaid) return;
    createContact.mutate(
      {
        leaid: addingToLeaid,
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
          setAddingToLeaid(null);
          setFormData(emptyForm);
        },
      }
    );
  }, [formData, addingToLeaid, createContact]);

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
    setAddingToLeaid(null);
  };

  const startAdd = (leaid: string) => {
    setIsAdding(true);
    setAddingToLeaid(leaid);
    setEditingId(null);
    setFormData(emptyForm);
    setExpandedDistrict(leaid);
  };

  const cancelForm = () => {
    setIsAdding(false);
    setAddingToLeaid(null);
    setEditingId(null);
    setFormData(emptyForm);
  };

  if (isLoading) {
    return (
      <div className="p-5 space-y-2 animate-pulse">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="h-10 bg-[#f0edf5] rounded-lg" />
        ))}
      </div>
    );
  }

  const totalContacts = contacts?.length ?? 0;

  if (totalContacts === 0 && !isAdding && districts.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-20 px-6 text-center">
        <svg className="w-9 h-9 text-[#C2BBD4] mb-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 19.128a9.38 9.38 0 002.625.372 9.337 9.337 0 004.121-.952 4.125 4.125 0 00-7.533-2.493M15 19.128v-.003c0-1.113-.285-2.16-.786-3.07M15 19.128v.106A12.318 12.318 0 018.624 21c-2.331 0-4.512-.645-6.374-1.766l-.001-.109a6.375 6.375 0 0111.964-3.07M12 6.375a3.375 3.375 0 11-6.75 0 3.375 3.375 0 016.75 0zm8.25 2.25a2.625 2.625 0 11-5.25 0 2.625 2.625 0 015.25 0z" />
        </svg>
        <p className="text-sm font-medium text-[#6E6390]">No contacts yet</p>
        <p className="text-xs text-[#A69DC0] mt-1">Add districts to this plan first, then add contacts.</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full">
      {/* Action bar */}
      {planName && (
        <div className="shrink-0 border-b border-[#E2DEEC]">
          <ContactsActionBar
            planId={planId}
            planName={planName}
            contacts={contacts || []}
            districtNameMap={districtNameMap}
            allDistrictLeaids={allDistrictLeaids}
            districtWebsiteMap={districtWebsiteMap}
            onEnrichingChange={setIsEnriching}
          />
        </div>
      )}

      {/* Section label */}
      <div className="shrink-0 px-5 pt-2.5 pb-1.5 flex items-baseline justify-between">
        <span className="text-[9px] font-bold uppercase tracking-wider text-[#A69DC0]">
          Contacts by District
        </span>
        <span className="text-[9px] text-[#C2BBD4]">
          Click district to expand · Click contact to edit
        </span>
      </div>

      {/* Table header */}
      <div className="shrink-0 border-y border-[#E2DEEC] bg-[#FAFAFE]">
        <div className="grid grid-cols-[1fr_80px_80px_80px] items-center px-5 py-2 text-[10px] font-bold uppercase tracking-wider text-[#A69DC0]">
          <span>District</span>
          <span className="text-center">Contacts</span>
          <span className="text-center">Primary</span>
          <span className="text-right">Depts</span>
        </div>
      </div>

      {/* District groups */}
      <div className="flex-1 overflow-y-auto">
        {districtGroups.map((group) => {
          const isExpanded = expandedDistrict === group.leaid;
          return (
            <DistrictContactGroup
              key={group.leaid}
              group={group}
              isExpanded={isExpanded}
              onToggle={() =>
                setExpandedDistrict((prev) =>
                  prev === group.leaid ? null : group.leaid
                )
              }
              editingId={editingId}
              onStartEdit={startEdit}
              onStartAdd={() => startAdd(group.leaid)}
              isAdding={isAdding && addingToLeaid === group.leaid}
              formData={formData}
              setFormData={setFormData}
              onSaveNew={handleSaveNew}
              onSaveEdit={handleSaveEdit}
              onCancel={cancelForm}
              isCreatePending={createContact.isPending}
              isUpdatePending={updateContact.isPending}
            />
          );
        })}
      </div>

      {/* Footer */}
      <div className="shrink-0 border-t border-[#E2DEEC] px-5 py-3 flex items-center justify-between bg-[#FAFAFE]">
        <span className="text-[11px] text-[#A69DC0]">
          {totalContacts} contact{totalContacts !== 1 ? "s" : ""}
          {" across "}
          {districtGroups.filter((g) => g.contacts.length > 0).length} district
          {districtGroups.filter((g) => g.contacts.length > 0).length !== 1 ? "s" : ""}
        </span>
      </div>
    </div>
  );
}

// ─── District Group Row ─────────────────────────────────────────

function DistrictContactGroup({
  group,
  isExpanded,
  onToggle,
  editingId,
  onStartEdit,
  onStartAdd,
  isAdding,
  formData,
  setFormData,
  onSaveNew,
  onSaveEdit,
  onCancel,
  isCreatePending,
  isUpdatePending,
}: {
  group: DistrictGroup;
  isExpanded: boolean;
  onToggle: () => void;
  editingId: number | null;
  onStartEdit: (contact: Contact) => void;
  onStartAdd: () => void;
  isAdding: boolean;
  formData: ContactFormData;
  setFormData: (data: ContactFormData) => void;
  onSaveNew: () => void;
  onSaveEdit: () => void;
  onCancel: () => void;
  isCreatePending: boolean;
  isUpdatePending: boolean;
}) {
  // Group contacts by department
  const deptGroups = useMemo(() => {
    const map = new Map<string, Contact[]>();
    for (const c of group.contacts) {
      const dept = c.persona ?? "Unassigned";
      const list = map.get(dept) ?? [];
      list.push(c);
      map.set(dept, list);
    }
    // Sort: assigned departments first alphabetically, then "Unassigned"
    return [...map.entries()].sort(([a], [b]) => {
      if (a === "Unassigned") return 1;
      if (b === "Unassigned") return -1;
      return a.localeCompare(b);
    });
  }, [group.contacts]);

  return (
    <div className={`${isExpanded ? "border-b-2 border-[#E2DEEC]" : "border-b border-[#f0edf5]"} last:border-b-0`}>
      {/* District header row */}
      <div
        className={`grid grid-cols-[1fr_80px_80px_80px] items-center px-5 py-2.5 cursor-pointer transition-colors ${
          isExpanded ? "bg-[#FAFAFE] border-b border-[#E2DEEC]" : "hover:bg-[#FAFAFE]"
        }`}
        onClick={onToggle}
      >
        <div className="flex items-center gap-2 min-w-0">
          <svg
            width="8"
            height="8"
            viewBox="0 0 8 8"
            className={`shrink-0 transition-transform ${isExpanded ? "rotate-90 text-[#403770]" : "text-[#C2BBD4]"}`}
          >
            <path d="M2.5 1L5.5 4L2.5 7" stroke="currentColor" strokeWidth={isExpanded ? "1.5" : "1.2"} fill="none" strokeLinecap="round" />
          </svg>
          <span className={`text-xs truncate ${isExpanded ? "font-semibold text-[#403770]" : "font-medium text-[#544A78]"}`}>
            {group.name}
          </span>
        </div>

        <span className="text-xs text-center tabular-nums font-semibold text-[#544A78]">
          {group.contacts.length || <span className="text-[#C2BBD4] font-normal">—</span>}
        </span>

        <span className="text-xs text-center tabular-nums">
          {group.primaryCount > 0 ? (
            <span className="inline-block px-1.5 py-0.5 rounded-full text-[9px] font-bold bg-[#403770]/8 text-[#403770]">
              {group.primaryCount}
            </span>
          ) : (
            <span className="text-[#C2BBD4]">—</span>
          )}
        </span>

        <span className="text-xs text-right tabular-nums text-[#8A80A8]">
          {group.departments.length > 0
            ? group.departments.filter((d) => d !== "Unassigned").length || "—"
            : "—"}
        </span>
      </div>

      {/* Expanded: contacts grouped by department */}
      {isExpanded && (
        <div className="bg-[#FAFAFE]">
          {group.contacts.length === 0 && !isAdding ? (
            <div className="pl-6 pr-5 py-4 text-center">
              <p className="text-xs text-[#A69DC0]">No contacts for this district</p>
              <button
                onClick={(e) => { e.stopPropagation(); onStartAdd(); }}
                className="mt-2 px-3 py-1.5 rounded-lg text-xs font-semibold text-white bg-[#403770] hover:bg-[#544A78] transition-colors"
              >
                + Add Contact
              </button>
            </div>
          ) : (
            <>
              {deptGroups.map(([dept, deptContacts]) => (
                <div key={dept} className="pl-6 pr-5">
                  {/* Department sub-header */}
                  <div className="flex items-center gap-2 py-2 border-b border-[#f0edf5]">
                    <span className="inline-block px-2 py-0.5 rounded-full text-[9px] font-bold bg-[#f0edf5] text-[#6E6390]">
                      {dept}
                    </span>
                    <span className="text-[10px] text-[#A69DC0]">
                      {deptContacts.length} contact{deptContacts.length !== 1 ? "s" : ""}
                    </span>
                  </div>

                  {/* Contact rows */}
                  {deptContacts.map((contact) =>
                    editingId === contact.id ? (
                      <div key={contact.id} className="py-2">
                        <ContactInlineForm
                          formData={formData}
                          setFormData={setFormData}
                          onSave={onSaveEdit}
                          onCancel={onCancel}
                          isPending={isUpdatePending}
                          isEditing
                        />
                      </div>
                    ) : (
                      <ContactRow
                        key={contact.id}
                        contact={contact}
                        onClick={() => onStartEdit(contact)}
                      />
                    )
                  )}
                </div>
              ))}

              {/* Add button within expanded district */}
              {!isAdding && (
                <div className="pl-6 pr-5 py-2 border-t border-[#f0edf5]">
                  <button
                    onClick={(e) => { e.stopPropagation(); onStartAdd(); }}
                    className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-[11px] font-semibold text-[#6EA3BE] hover:text-[#3D5A80] hover:bg-[#C4E7E6]/20 transition-colors"
                  >
                    <svg width="9" height="9" viewBox="0 0 10 10" fill="none">
                      <path d="M5 1V9M1 5H9" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
                    </svg>
                    Add Contact
                  </button>
                </div>
              )}

              {/* Inline add form */}
              {isAdding && (
                <div className="pl-6 pr-5 py-2">
                  <ContactInlineForm
                    formData={formData}
                    setFormData={setFormData}
                    onSave={onSaveNew}
                    onCancel={onCancel}
                    isPending={isCreatePending}
                  />
                </div>
              )}
            </>
          )}
        </div>
      )}
    </div>
  );
}

// ─── Contact Row ────────────────────────────────────────────────

function ContactRow({ contact, onClick }: { contact: Contact; onClick: () => void }) {
  return (
    <div
      onClick={onClick}
      className="flex items-center gap-3 py-2.5 border-b border-[#f0edf5] last:border-b-0 cursor-pointer hover:bg-white transition-colors group"
    >
      {/* Avatar */}
      <div className="w-8 h-8 rounded-full bg-[#f0edf5] flex items-center justify-center shrink-0">
        <span className="text-[10px] font-bold text-[#8A80A8]">
          {(contact.name ?? "?").charAt(0).toUpperCase()}
        </span>
      </div>

      {/* Info */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span className="text-[11px] font-semibold text-[#544A78] truncate group-hover:text-[#403770]">
            {contact.name}
          </span>
          {contact.isPrimary && (
            <span className="px-1 py-0.5 rounded text-[8px] font-bold uppercase bg-[#403770]/8 text-[#403770]">
              Primary
            </span>
          )}
          {contact.seniorityLevel && (
            <span className="text-[9px] text-[#A69DC0]">{contact.seniorityLevel}</span>
          )}
        </div>
        {contact.title && (
          <p className="text-[10px] text-[#8A80A8] truncate">{contact.title}</p>
        )}
      </div>

      {/* Quick actions */}
      <div className="flex items-center gap-1 shrink-0" onClick={(e) => e.stopPropagation()}>
        {contact.email && (
          <a
            href={`mailto:${contact.email}`}
            className="w-6 h-6 rounded-lg hover:bg-[#f0edf5] flex items-center justify-center text-[#A69DC0] hover:text-[#6E6390] transition-colors"
            title={contact.email}
          >
            <svg width="11" height="11" viewBox="0 0 12 12" fill="none">
              <rect x="1" y="2.5" width="10" height="7" rx="1.5" stroke="currentColor" strokeWidth="1.2" />
              <path d="M1.5 3L6 6.5L10.5 3" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </a>
        )}
        {contact.phone && (
          <a
            href={`tel:${contact.phone}`}
            className="w-6 h-6 rounded-lg hover:bg-[#f0edf5] flex items-center justify-center text-[#A69DC0] hover:text-[#6E6390] transition-colors"
            title={contact.phone}
          >
            <svg width="11" height="11" viewBox="0 0 12 12" fill="none">
              <path d="M3.5 1.5L5 4L3.5 5C4.2 6.5 5.5 7.8 7 8.5L8 7L10.5 8.5V10C10.5 10.3 10.3 10.5 10 10.5C5.3 10.2 1.8 6.7 1.5 2C1.5 1.7 1.7 1.5 2 1.5H3.5Z" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </a>
        )}
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
