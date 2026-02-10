"use client";

// ContactsTable - Attio/HubSpot-inspired CRM table for contacts
// Features: Checkbox row selection with bulk actions, avatar initials,
// district column, combined Person cell (name + title), Last Activity
// placeholder for future tracing, persona/seniority badges, footer count

import { useState, useMemo, useCallback } from "react";
import type { Contact } from "@/lib/api";

// Generate a consistent color from a contact's name for their avatar
// Uses the brand palette so every avatar feels intentional
const AVATAR_COLORS = [
  { bg: "#403770", text: "#FFFFFF" },  // plum
  { bg: "#6EA3BE", text: "#FFFFFF" },  // steel blue
  { bg: "#F37167", text: "#FFFFFF" },  // coral
  { bg: "#C4E7E6", text: "#403770" },  // robin's egg
  { bg: "#8AA891", text: "#FFFFFF" },  // sage
  { bg: "#5C4E8C", text: "#FFFFFF" },  // light plum
];

function getAvatarColor(name: string) {
  // Simple hash: sum char codes, mod by palette length
  let hash = 0;
  for (let i = 0; i < name.length; i++) {
    hash = name.charCodeAt(i) + ((hash << 5) - hash);
  }
  return AVATAR_COLORS[Math.abs(hash) % AVATAR_COLORS.length];
}

function getInitials(name: string): string {
  const parts = name.trim().split(/\s+/);
  if (parts.length >= 2) {
    return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
  }
  return name.slice(0, 2).toUpperCase();
}

// Delete confirmation modal
function DeleteConfirmModal({
  contact,
  onConfirm,
  onCancel,
}: {
  contact: Contact;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/40 backdrop-blur-[2px]" onClick={onCancel} />
      <div
        className="relative bg-white rounded-xl shadow-2xl w-full max-w-sm mx-4 p-6"
        style={{ animation: "tooltipEnter 200ms cubic-bezier(0.16, 1, 0.3, 1) forwards" }}
      >
        <h3 className="text-lg font-semibold text-[#403770] mb-2">Delete Contact?</h3>
        <p className="text-gray-600 text-sm mb-6">
          Are you sure you want to delete &ldquo;{contact.name}&rdquo;? This action cannot be undone.
        </p>
        <div className="flex justify-end gap-3">
          <button
            onClick={onCancel}
            className="px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-100 rounded-lg transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={onConfirm}
            className="px-4 py-2 text-sm font-medium text-white bg-red-500 hover:bg-red-600 rounded-lg transition-colors"
          >
            Delete
          </button>
        </div>
      </div>
    </div>
  );
}

interface ContactsTableProps {
  contacts: Contact[];
  // Map of leaid -> district name so we can display which district each contact belongs to
  districtNameMap?: Map<string, string>;
  // Total unfiltered count — when filters are active we show "X of Y contacts"
  totalCount?: number;
  onEdit?: (contact: Contact) => void;
  onDelete?: (contactId: number) => void;
}

export default function ContactsTable({
  contacts,
  districtNameMap,
  totalCount,
  onEdit,
  onDelete,
}: ContactsTableProps) {
  // Track which contact IDs are selected for bulk actions
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());
  const [contactToDelete, setContactToDelete] = useState<Contact | null>(null);

  const allSelected = contacts.length > 0 && selectedIds.size === contacts.length;
  const someSelected = selectedIds.size > 0 && selectedIds.size < contacts.length;

  const toggleSelect = useCallback((id: number) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  const toggleSelectAll = useCallback(() => {
    if (allSelected) setSelectedIds(new Set());
    else setSelectedIds(new Set(contacts.map((c) => c.id)));
  }, [allSelected, contacts]);

  const clearSelection = useCallback(() => setSelectedIds(new Set()), []);

  // Collect emails of selected contacts for bulk mailto
  const selectedEmails = useMemo(() => {
    return contacts
      .filter((c) => selectedIds.has(c.id) && c.email)
      .map((c) => c.email!);
  }, [contacts, selectedIds]);

  // Export selected contacts as a CSV download
  const handleExportCsv = useCallback(() => {
    const selected = contacts.filter((c) => selectedIds.has(c.id));
    const headers = ["Name", "Email", "Title", "District", "Department", "Seniority", "Phone"];
    const rows = selected.map((c) => [
      c.name,
      c.email || "",
      c.title || "",
      districtNameMap?.get(c.leaid) || c.leaid,
      c.persona || "",
      c.seniorityLevel || "",
      c.phone || "",
    ]);

    const csvContent = [headers, ...rows]
      .map((row) => row.map((cell) => `"${cell.replace(/"/g, '""')}"`).join(","))
      .join("\n");

    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `contacts-export-${new Date().toISOString().split("T")[0]}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  }, [contacts, selectedIds, districtNameMap]);

  const handleDeleteConfirm = () => {
    if (contactToDelete && onDelete) {
      onDelete(contactToDelete.id);
      setContactToDelete(null);
    }
  };

  // Footer: "12 of 42 contacts" when filtered, otherwise "42 contacts"
  const footerText = useMemo(() => {
    if (totalCount && totalCount !== contacts.length) {
      return `${contacts.length} of ${totalCount} contacts`;
    }
    return `${contacts.length} contact${contacts.length !== 1 ? "s" : ""}`;
  }, [contacts.length, totalCount]);

  // Empty state
  if (contacts.length === 0) {
    return (
      <div className="text-center py-16 bg-white rounded-lg border border-gray-200">
        <div className="w-14 h-14 mx-auto mb-4 rounded-full bg-[#C4E7E6]/40 flex items-center justify-center">
          <svg className="w-7 h-7 text-[#6EA3BE]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
          </svg>
        </div>
        <h3 className="text-base font-semibold text-[#403770] mb-1">No contacts yet</h3>
        <p className="text-sm text-gray-500 max-w-xs mx-auto">
          Add contacts from the district detail panel or use Clay to find contacts.
        </p>
      </div>
    );
  }

  return (
    <div className="relative">
      {/* Table */}
      <div className="overflow-hidden border border-gray-200 rounded-lg bg-white shadow-sm">
        <div className="overflow-x-auto">
          <table className="min-w-full">
            {/* ── Header ── */}
            <thead>
              <tr className="border-b border-gray-200 bg-gray-50/80">
                {/* Select-all */}
                <th className="w-12 pl-4 pr-2 py-3">
                  <input
                    type="checkbox"
                    checked={allSelected}
                    ref={(el) => { if (el) el.indeterminate = someSelected; }}
                    onChange={toggleSelectAll}
                    className="w-4 h-4 rounded border-gray-300 text-[#403770] focus:ring-[#403770]/30 cursor-pointer transition-shadow"
                    aria-label="Select all contacts"
                  />
                </th>
                <th className="px-4 py-3 text-left text-[11px] font-semibold text-gray-500 uppercase tracking-wider">
                  Person
                </th>
                <th className="px-4 py-3 text-left text-[11px] font-semibold text-gray-500 uppercase tracking-wider">
                  Email
                </th>
                <th className="px-4 py-3 text-left text-[11px] font-semibold text-gray-500 uppercase tracking-wider">
                  District
                </th>
                <th className="px-4 py-3 text-left text-[11px] font-semibold text-gray-500 uppercase tracking-wider">
                  Department
                </th>
                <th className="px-4 py-3 text-left text-[11px] font-semibold text-gray-500 uppercase tracking-wider">
                  Seniority
                </th>
                <th className="px-4 py-3 text-left text-[11px] font-semibold text-gray-500 uppercase tracking-wider">
                  Last Activity
                </th>
                <th className="w-20 px-3 py-3" />
              </tr>
            </thead>

            {/* ── Rows ── */}
            <tbody>
              {contacts.map((contact, idx) => {
                const isSelected = selectedIds.has(contact.id);
                const districtName = districtNameMap?.get(contact.leaid);
                const avatarColor = getAvatarColor(contact.name);
                const initials = getInitials(contact.name);
                const isLast = idx === contacts.length - 1;

                return (
                  <tr
                    key={contact.id}
                    className={`
                      group transition-colors duration-100
                      ${!isLast ? "border-b border-gray-100" : ""}
                      ${isSelected
                        ? "bg-[#C4E7E6]/15 hover:bg-[#C4E7E6]/25"
                        : "hover:bg-gray-50/70"
                      }
                    `}
                  >
                    {/* Checkbox */}
                    <td className="pl-4 pr-2 py-3">
                      <input
                        type="checkbox"
                        checked={isSelected}
                        onChange={() => toggleSelect(contact.id)}
                        className="w-4 h-4 rounded border-gray-300 text-[#403770] focus:ring-[#403770]/30 cursor-pointer transition-shadow"
                        aria-label={`Select ${contact.name}`}
                      />
                    </td>

                    {/* Person: avatar + name/title stack */}
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-3 min-w-0">
                        {/* Avatar initials circle */}
                        <div
                          className="w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 text-[11px] font-bold tracking-tight"
                          style={{ backgroundColor: avatarColor.bg, color: avatarColor.text }}
                        >
                          {initials}
                        </div>
                        <div className="min-w-0">
                          <div className="flex items-center gap-2">
                            <span className="text-sm font-medium text-[#403770] truncate">
                              {contact.salutation ? `${contact.salutation} ` : ""}
                              {contact.name}
                            </span>
                            {contact.isPrimary && (
                              <span className="flex-shrink-0 px-1.5 py-px text-[9px] font-bold uppercase tracking-wide bg-[#F37167] text-white rounded">
                                Primary
                              </span>
                            )}
                          </div>
                          {contact.title && (
                            <p className="text-[12px] text-gray-400 truncate max-w-[200px] leading-tight mt-0.5">
                              {contact.title}
                            </p>
                          )}
                        </div>
                      </div>
                    </td>

                    {/* Email */}
                    <td className="px-4 py-3">
                      {contact.email ? (
                        <a
                          href={`mailto:${contact.email}`}
                          className="text-[13px] text-[#6EA3BE] hover:text-[#403770] transition-colors truncate max-w-[200px] block"
                        >
                          {contact.email}
                        </a>
                      ) : (
                        <span className="text-[13px] text-gray-300">&mdash;</span>
                      )}
                    </td>

                    {/* District */}
                    <td className="px-4 py-3">
                      {districtName ? (
                        <span className="text-[13px] text-[#403770]/80 truncate max-w-[180px] block">
                          {districtName}
                        </span>
                      ) : (
                        <span className="text-[13px] text-gray-300">&mdash;</span>
                      )}
                    </td>

                    {/* Department */}
                    <td className="px-4 py-3">
                      {contact.persona ? (
                        <span className="text-[13px] text-[#403770]/70 whitespace-nowrap">
                          {contact.persona}
                        </span>
                      ) : (
                        <span className="text-[13px] text-gray-300">&mdash;</span>
                      )}
                    </td>

                    {/* Seniority */}
                    <td className="px-4 py-3">
                      {contact.seniorityLevel ? (
                        <span className="text-[13px] text-[#403770]/70 whitespace-nowrap">
                          {contact.seniorityLevel}
                        </span>
                      ) : (
                        <span className="text-[13px] text-gray-300">&mdash;</span>
                      )}
                    </td>

                    {/* Last Activity — placeholder, will light up with tracing */}
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-1.5">
                        <span className="w-1.5 h-1.5 rounded-full bg-gray-200" />
                        <span className="text-[12px] text-gray-300">No activity</span>
                      </div>
                    </td>

                    {/* Actions — appear on hover */}
                    <td className="px-3 py-3">
                      <div className="flex items-center justify-end gap-1 opacity-0 group-hover:opacity-100 transition-opacity duration-150">
                        {contact.linkedinUrl && (
                          <a
                            href={contact.linkedinUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="p-1.5 text-gray-400 hover:text-[#0A66C2] rounded-md hover:bg-gray-100 transition-colors"
                            aria-label="View LinkedIn profile"
                          >
                            <svg className="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 24 24">
                              <path d="M19 3a2 2 0 012 2v14a2 2 0 01-2 2H5a2 2 0 01-2-2V5a2 2 0 012-2h14m-.5 15.5v-5.3a3.26 3.26 0 00-3.26-3.26c-.85 0-1.84.52-2.32 1.3v-1.11h-2.79v8.37h2.79v-4.93c0-.77.62-1.4 1.39-1.4a1.4 1.4 0 011.4 1.4v4.93h2.79M6.88 8.56a1.68 1.68 0 001.68-1.68c0-.93-.75-1.69-1.68-1.69a1.69 1.69 0 00-1.69 1.69c0 .93.76 1.68 1.69 1.68m1.39 9.94v-8.37H5.5v8.37h2.77z" />
                            </svg>
                          </a>
                        )}
                        {onEdit && (
                          <button
                            onClick={() => onEdit(contact)}
                            className="p-1.5 text-gray-400 hover:text-[#403770] rounded-md hover:bg-gray-100 transition-colors"
                            aria-label="Edit contact"
                          >
                            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                            </svg>
                          </button>
                        )}
                        {onDelete && (
                          <button
                            onClick={() => setContactToDelete(contact)}
                            className="p-1.5 text-gray-400 hover:text-red-500 rounded-md hover:bg-red-50 transition-colors"
                            aria-label="Delete contact"
                          >
                            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                            </svg>
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {/* Footer */}
        <div className="px-4 py-2.5 border-t border-gray-100 bg-gray-50/60 flex items-center justify-between">
          <span className="text-[12px] font-medium text-gray-400 tracking-wide">
            {footerText}
          </span>
          {selectedIds.size > 0 && (
            <span className="text-[12px] text-[#403770] font-medium">
              {selectedIds.size} selected
            </span>
          )}
        </div>
      </div>

      {/* ── Bulk Action Bar ── */}
      {/* Floats above the table bottom when contacts are selected */}
      {selectedIds.size > 0 && (
        <div
          className="sticky bottom-4 mt-3 flex justify-center pointer-events-none"
          style={{ animation: "tooltipEnter 250ms cubic-bezier(0.16, 1, 0.3, 1) forwards" }}
        >
          <div className="pointer-events-auto inline-flex items-center gap-1 px-2 py-1.5 bg-[#403770] rounded-xl shadow-xl shadow-[#403770]/20 border border-white/10">
            {/* Count badge */}
            <div className="flex items-center gap-2 px-3 py-1">
              <span className="inline-flex items-center justify-center w-6 h-6 text-[11px] font-bold bg-white text-[#403770] rounded-lg">
                {selectedIds.size}
              </span>
              <span className="text-[13px] font-medium text-white/90">selected</span>
            </div>

            <span className="w-px h-6 bg-white/15" />

            {/* Send Email */}
            {selectedEmails.length > 0 && (
              <a
                href={`mailto:${selectedEmails.join(",")}`}
                className="inline-flex items-center gap-2 px-3 py-1.5 text-[13px] font-medium text-white hover:bg-white/10 rounded-lg transition-colors"
              >
                <svg className="w-4 h-4 text-white/70" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                </svg>
                Send Email
              </a>
            )}

            {/* Export CSV */}
            <button
              onClick={handleExportCsv}
              className="inline-flex items-center gap-2 px-3 py-1.5 text-[13px] font-medium text-white hover:bg-white/10 rounded-lg transition-colors"
            >
              <svg className="w-4 h-4 text-white/70" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
              Export CSV
            </button>

            <span className="w-px h-6 bg-white/15" />

            {/* Clear */}
            <button
              onClick={clearSelection}
              className="p-2 text-white/50 hover:text-white hover:bg-white/10 rounded-lg transition-colors"
              aria-label="Clear selection"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {contactToDelete && (
        <DeleteConfirmModal
          contact={contactToDelete}
          onConfirm={handleDeleteConfirm}
          onCancel={() => setContactToDelete(null)}
        />
      )}
    </div>
  );
}
