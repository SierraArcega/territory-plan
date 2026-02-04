"use client";

// ContactsTable - Compact, modern table for displaying contacts
// Features: Inline editing support, persona/seniority badges, primary contact indicator

import { useState } from "react";
import type { Contact } from "@/lib/api";
import {
  PERSONA_COLORS,
  SENIORITY_COLORS,
  type Persona,
  type SeniorityLevel,
} from "@/lib/contactTypes";

// Delete confirmation modal
interface DeleteConfirmModalProps {
  contact: Contact;
  onConfirm: () => void;
  onCancel: () => void;
}

function DeleteConfirmModal({ contact, onConfirm, onCancel }: DeleteConfirmModalProps) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/50" onClick={onCancel} />
      <div className="relative bg-white rounded-xl shadow-2xl w-full max-w-sm mx-4 p-6">
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
  onEdit?: (contact: Contact) => void;
  onDelete?: (contactId: number) => void;
}

export default function ContactsTable({ contacts, onEdit, onDelete }: ContactsTableProps) {
  const [contactToDelete, setContactToDelete] = useState<Contact | null>(null);

  const handleDeleteConfirm = () => {
    if (contactToDelete && onDelete) {
      onDelete(contactToDelete.id);
      setContactToDelete(null);
    }
  };

  // Empty state
  if (contacts.length === 0) {
    return (
      <div className="text-center py-12 bg-white rounded-lg border border-gray-200">
        <svg
          className="w-16 h-16 mx-auto text-gray-300 mb-4"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={1.5}
            d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z"
          />
        </svg>
        <h3 className="text-lg font-medium text-gray-600 mb-2">No contacts yet</h3>
        <p className="text-sm text-gray-500 max-w-sm mx-auto">
          Add contacts from the district detail panel or use Clay to find contacts.
        </p>
      </div>
    );
  }

  return (
    <div className="overflow-hidden border border-gray-200 rounded-lg bg-white">
      <div className="overflow-x-auto">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-4 py-2.5 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
                Name
              </th>
              <th className="px-4 py-2.5 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
                Title
              </th>
              <th className="px-4 py-2.5 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
                Email
              </th>
              <th className="px-4 py-2.5 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
                Phone
              </th>
              <th className="w-[100px] px-4 py-2.5 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
                Persona
              </th>
              <th className="w-[100px] px-4 py-2.5 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
                Seniority
              </th>
              <th className="w-[70px] px-3 py-2.5 text-right text-xs font-semibold text-gray-600 uppercase tracking-wider">
                Actions
              </th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-100">
            {contacts.map((contact) => {
              const personaColors = contact.persona ? PERSONA_COLORS[contact.persona as Persona] : null;
              const seniorityColors = contact.seniorityLevel ? SENIORITY_COLORS[contact.seniorityLevel as SeniorityLevel] : null;

              return (
                <tr
                  key={contact.id}
                  className="hover:bg-gray-50 transition-colors"
                >
                  {/* Name with primary indicator */}
                  <td className="px-4 py-2.5">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium text-[#403770]">
                        {contact.salutation ? `${contact.salutation} ` : ""}{contact.name}
                      </span>
                      {contact.isPrimary && (
                        <span className="px-1.5 py-0.5 text-[10px] font-semibold bg-[#F37167] text-white rounded">
                          PRIMARY
                        </span>
                      )}
                    </div>
                  </td>

                  {/* Title */}
                  <td className="px-4 py-2.5">
                    <span className="text-sm text-gray-600 truncate max-w-[180px] block">
                      {contact.title || <span className="text-gray-400 italic">—</span>}
                    </span>
                  </td>

                  {/* Email */}
                  <td className="px-4 py-2.5">
                    {contact.email ? (
                      <a
                        href={`mailto:${contact.email}`}
                        className="text-sm text-[#403770] hover:text-[#F37167] transition-colors truncate max-w-[180px] block"
                      >
                        {contact.email}
                      </a>
                    ) : (
                      <span className="text-sm text-gray-400 italic">—</span>
                    )}
                  </td>

                  {/* Phone */}
                  <td className="px-4 py-2.5">
                    {contact.phone ? (
                      <a
                        href={`tel:${contact.phone}`}
                        className="text-sm text-gray-600 hover:text-[#403770] transition-colors"
                      >
                        {contact.phone}
                      </a>
                    ) : (
                      <span className="text-sm text-gray-400 italic">—</span>
                    )}
                  </td>

                  {/* Persona badge */}
                  <td className="px-4 py-2.5">
                    {contact.persona ? (
                      <span
                        className="inline-block px-2 py-0.5 text-xs font-medium rounded-full"
                        style={{
                          backgroundColor: personaColors?.bg || "#F3F4F6",
                          color: personaColors?.text || "#6B7280",
                        }}
                      >
                        {contact.persona}
                      </span>
                    ) : (
                      <span className="text-sm text-gray-400 italic">—</span>
                    )}
                  </td>

                  {/* Seniority badge */}
                  <td className="px-4 py-2.5">
                    {contact.seniorityLevel ? (
                      <span
                        className="inline-block px-2 py-0.5 text-xs font-medium rounded-full"
                        style={{
                          backgroundColor: seniorityColors?.bg || "#F3F4F6",
                          color: seniorityColors?.text || "#6B7280",
                        }}
                      >
                        {contact.seniorityLevel}
                      </span>
                    ) : (
                      <span className="text-sm text-gray-400 italic">—</span>
                    )}
                  </td>

                  {/* Actions */}
                  <td className="px-3 py-2.5 text-right">
                    <div className="flex items-center justify-end gap-2">
                      {contact.linkedinUrl && (
                        <a
                          href={contact.linkedinUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-[#0A66C2] hover:text-[#004182] transition-colors"
                          aria-label="View LinkedIn profile"
                        >
                          <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
                            <path d="M19 3a2 2 0 012 2v14a2 2 0 01-2 2H5a2 2 0 01-2-2V5a2 2 0 012-2h14m-.5 15.5v-5.3a3.26 3.26 0 00-3.26-3.26c-.85 0-1.84.52-2.32 1.3v-1.11h-2.79v8.37h2.79v-4.93c0-.77.62-1.4 1.39-1.4a1.4 1.4 0 011.4 1.4v4.93h2.79M6.88 8.56a1.68 1.68 0 001.68-1.68c0-.93-.75-1.69-1.68-1.69a1.69 1.69 0 00-1.69 1.69c0 .93.76 1.68 1.69 1.68m1.39 9.94v-8.37H5.5v8.37h2.77z" />
                          </svg>
                        </a>
                      )}
                      {onEdit && (
                        <button
                          onClick={() => onEdit(contact)}
                          className="text-xs text-[#403770] hover:text-[#F37167] transition-colors"
                          aria-label="Edit contact"
                        >
                          Edit
                        </button>
                      )}
                      {onDelete && (
                        <button
                          onClick={() => setContactToDelete(contact)}
                          className="text-xs text-red-500 hover:text-red-700 transition-colors"
                          aria-label="Delete contact"
                        >
                          Delete
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
