"use client";

import { useState } from "react";
import {
  useCreateContact,
  useUpdateContact,
  useDeleteContact,
  useTriggerClayLookup,
  type Contact,
} from "@/lib/api";
import { PERSONAS, SENIORITY_LEVELS } from "@/lib/contactTypes";

interface ContactsListProps {
  leaid: string;
  contacts: Contact[];
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

export default function ContactsList({ leaid, contacts }: ContactsListProps) {
  const [isAdding, setIsAdding] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [formData, setFormData] = useState<ContactFormData>(emptyForm);
  const [clayLookupMessage, setClayLookupMessage] = useState<string | null>(null);

  const createMutation = useCreateContact();
  const updateMutation = useUpdateContact();
  const deleteMutation = useDeleteContact();
  const clayLookupMutation = useTriggerClayLookup();

  const handleStartAdd = () => {
    setIsAdding(true);
    setEditingId(null);
    setFormData(emptyForm);
  };

  const handleStartEdit = (contact: Contact) => {
    setEditingId(contact.id);
    setIsAdding(false);
    setFormData({
      salutation: contact.salutation || "",
      name: contact.name,
      title: contact.title || "",
      email: contact.email || "",
      phone: contact.phone || "",
      isPrimary: contact.isPrimary,
      linkedinUrl: contact.linkedinUrl || "",
      persona: contact.persona || "",
      seniorityLevel: contact.seniorityLevel || "",
    });
  };

  const handleCancel = () => {
    setIsAdding(false);
    setEditingId(null);
    setFormData(emptyForm);
  };

  const handleSave = async () => {
    if (!formData.name.trim()) return;

    try {
      if (editingId) {
        await updateMutation.mutateAsync({
          id: editingId,
          leaid,
          ...formData,
        });
      } else {
        await createMutation.mutateAsync({
          leaid,
          ...formData,
        });
      }
      handleCancel();
    } catch (error) {
      console.error("Failed to save contact:", error);
    }
  };

  const handleDelete = async (id: number) => {
    if (!confirm("Are you sure you want to delete this contact?")) return;

    try {
      await deleteMutation.mutateAsync({ id, leaid });
    } catch (error) {
      console.error("Failed to delete contact:", error);
    }
  };

  // Trigger Clay to find and enrich contacts for this district
  const handleFindContacts = async () => {
    setClayLookupMessage(null);
    try {
      const result = await clayLookupMutation.mutateAsync(leaid);
      // Show success message - contacts will appear after Clay processes and calls our webhook
      setClayLookupMessage(
        "Looking up contacts... They will appear here once Clay finishes processing."
      );
      // Clear the message after 10 seconds
      setTimeout(() => setClayLookupMessage(null), 10000);
    } catch (error) {
      console.error("Failed to trigger Clay lookup:", error);
      setClayLookupMessage("Failed to start contact lookup. Please try again.");
      setTimeout(() => setClayLookupMessage(null), 5000);
    }
  };

  const isPending =
    createMutation.isPending ||
    updateMutation.isPending ||
    deleteMutation.isPending;

  const isClayLookupPending = clayLookupMutation.isPending;

  return (
    <div>
      <div className="flex justify-between items-center mb-3">
        <h3 className="text-sm font-bold text-[#403770]">Contacts</h3>
        {!isAdding && !editingId && (
          <div className="flex gap-2">
            {/* Clay lookup button - find or refresh contacts */}
            <button
              onClick={handleFindContacts}
              disabled={isClayLookupPending}
              className="text-xs text-[#6EA3BE] hover:text-[#403770] font-medium disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-1"
              title="Use Clay to find contacts at this district"
            >
              {isClayLookupPending ? (
                <>
                  <svg className="w-3 h-3 animate-spin" viewBox="0 0 24 24" fill="none">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                  </svg>
                  Looking up...
                </>
              ) : contacts.length === 0 ? (
                "Find Contacts"
              ) : (
                "Refresh from Clay"
              )}
            </button>
            {/* Manual add contact button */}
            <button
              onClick={handleStartAdd}
              className="text-xs text-[#F37167] hover:text-[#403770] font-medium"
            >
              + Add Contact
            </button>
          </div>
        )}
      </div>

      {/* Clay lookup status message */}
      {clayLookupMessage && (
        <div className="mb-3 p-2 text-xs rounded-md bg-[#C4E7E6]/30 text-[#403770]">
          {clayLookupMessage}
        </div>
      )}

      {/* Contact List */}
      <div className="space-y-3">
        {contacts.map((contact) => (
          <div key={contact.id}>
            {editingId === contact.id ? (
              <ContactForm
                formData={formData}
                setFormData={setFormData}
                onSave={handleSave}
                onCancel={handleCancel}
                isPending={isPending}
              />
            ) : (
              <div className="p-3 bg-gray-50 rounded-lg">
                <div className="flex justify-between items-start">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-medium text-[#403770]">
                        {contact.salutation ? `${contact.salutation} ` : ""}{contact.name}
                      </span>
                      {contact.isPrimary && (
                        <span className="text-xs px-1.5 py-0.5 bg-[#F37167] text-white rounded">
                          Primary
                        </span>
                      )}
                    </div>
                    {contact.title && (
                      <p className="text-sm text-gray-600">{contact.title}</p>
                    )}
                    {contact.email && (
                      <a
                        href={`mailto:${contact.email}`}
                        className="text-sm text-[#6EA3BE] hover:underline block"
                      >
                        {contact.email}
                      </a>
                    )}
                    {contact.linkedinUrl && (
                      <a
                        href={contact.linkedinUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-sm text-[#0A66C2] hover:underline flex items-center gap-1"
                      >
                        <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="currentColor">
                          <path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433c-1.144 0-2.063-.926-2.063-2.065 0-1.138.92-2.063 2.063-2.063 1.14 0 2.064.925 2.064 2.063 0 1.139-.925 2.065-2.064 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z"/>
                        </svg>
                        LinkedIn
                      </a>
                    )}
                    {contact.phone && (
                      <p className="text-sm text-gray-600">{contact.phone}</p>
                    )}
                    {(contact.persona || contact.seniorityLevel) && (
                      <div className="flex flex-wrap gap-1 mt-1.5">
                        {contact.persona && (
                          <span className="text-xs px-1.5 py-0.5 bg-[#C4E7E6] text-[#403770] rounded">
                            {contact.persona}
                          </span>
                        )}
                        {contact.seniorityLevel && (
                          <span className="text-xs px-1.5 py-0.5 bg-gray-200 text-gray-700 rounded">
                            {contact.seniorityLevel}
                          </span>
                        )}
                      </div>
                    )}
                  </div>
                  <div className="flex gap-1">
                    <button
                      onClick={() => handleStartEdit(contact)}
                      className="p-1 text-gray-400 hover:text-[#403770]"
                      aria-label="Edit contact"
                    >
                      <svg
                        className="w-4 h-4"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z"
                        />
                      </svg>
                    </button>
                    <button
                      onClick={() => handleDelete(contact.id)}
                      className="p-1 text-gray-400 hover:text-red-500"
                      aria-label="Delete contact"
                    >
                      <svg
                        className="w-4 h-4"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
                        />
                      </svg>
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>
        ))}

        {contacts.length === 0 && !isAdding && (
          <p className="text-sm text-gray-400 italic">No contacts</p>
        )}

        {/* Add Form */}
        {isAdding && (
          <ContactForm
            formData={formData}
            setFormData={setFormData}
            onSave={handleSave}
            onCancel={handleCancel}
            isPending={isPending}
          />
        )}
      </div>
    </div>
  );
}

interface ContactFormProps {
  formData: ContactFormData;
  setFormData: (data: ContactFormData) => void;
  onSave: () => void;
  onCancel: () => void;
  isPending: boolean;
}

function ContactForm({
  formData,
  setFormData,
  onSave,
  onCancel,
  isPending,
}: ContactFormProps) {
  return (
    <div className="p-3 bg-[#C4E7E6]/20 rounded-lg space-y-2">
      <div className="flex gap-2">
        <input
          type="text"
          value={formData.salutation}
          onChange={(e) => setFormData({ ...formData, salutation: e.target.value })}
          placeholder="Salutation"
          className="w-20 px-2 py-1.5 text-sm border border-gray-200 rounded-md focus:outline-none focus:ring-2 focus:ring-[#F37167] focus:border-transparent"
        />
        <input
          type="text"
          value={formData.name}
          onChange={(e) => setFormData({ ...formData, name: e.target.value })}
          placeholder="Name *"
          className="flex-1 px-2 py-1.5 text-sm border border-gray-200 rounded-md focus:outline-none focus:ring-2 focus:ring-[#F37167] focus:border-transparent"
        />
      </div>
      <input
        type="text"
        value={formData.title}
        onChange={(e) => setFormData({ ...formData, title: e.target.value })}
        placeholder="Title"
        className="w-full px-2 py-1.5 text-sm border border-gray-200 rounded-md focus:outline-none focus:ring-2 focus:ring-[#F37167] focus:border-transparent"
      />
      <input
        type="email"
        value={formData.email}
        onChange={(e) => setFormData({ ...formData, email: e.target.value })}
        placeholder="Email"
        className="w-full px-2 py-1.5 text-sm border border-gray-200 rounded-md focus:outline-none focus:ring-2 focus:ring-[#F37167] focus:border-transparent"
      />
      <input
        type="tel"
        value={formData.phone}
        onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
        placeholder="Phone"
        className="w-full px-2 py-1.5 text-sm border border-gray-200 rounded-md focus:outline-none focus:ring-2 focus:ring-[#F37167] focus:border-transparent"
      />
      <input
        type="url"
        value={formData.linkedinUrl}
        onChange={(e) => setFormData({ ...formData, linkedinUrl: e.target.value })}
        placeholder="LinkedIn URL"
        className="w-full px-2 py-1.5 text-sm border border-gray-200 rounded-md focus:outline-none focus:ring-2 focus:ring-[#F37167] focus:border-transparent"
      />
      <div className="flex gap-2">
        <select
          value={formData.persona}
          onChange={(e) => setFormData({ ...formData, persona: e.target.value })}
          className="flex-1 px-2 py-1.5 text-sm border border-gray-200 rounded-md focus:outline-none focus:ring-2 focus:ring-[#F37167] focus:border-transparent"
        >
          <option value="">Select Department...</option>
          {PERSONAS.map((p) => (
            <option key={p} value={p}>{p}</option>
          ))}
        </select>
        <select
          value={formData.seniorityLevel}
          onChange={(e) => setFormData({ ...formData, seniorityLevel: e.target.value })}
          className="flex-1 px-2 py-1.5 text-sm border border-gray-200 rounded-md focus:outline-none focus:ring-2 focus:ring-[#F37167] focus:border-transparent"
        >
          <option value="">Select Seniority...</option>
          {SENIORITY_LEVELS.map((s) => (
            <option key={s} value={s}>{s}</option>
          ))}
        </select>
      </div>
      <label className="flex items-center gap-2 text-sm">
        <input
          type="checkbox"
          checked={formData.isPrimary}
          onChange={(e) =>
            setFormData({ ...formData, isPrimary: e.target.checked })
          }
          className="rounded border-gray-300 text-[#F37167] focus:ring-[#F37167]"
        />
        Primary contact
      </label>
      <div className="flex justify-end gap-2 pt-1">
        <button
          onClick={onCancel}
          className="px-3 py-1.5 text-sm text-gray-600 hover:text-[#403770]"
        >
          Cancel
        </button>
        <button
          onClick={onSave}
          disabled={!formData.name.trim() || isPending}
          className="px-3 py-1.5 text-sm bg-[#F37167] text-white rounded-md hover:bg-[#e05f55] disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {isPending ? "Saving..." : "Save"}
        </button>
      </div>
    </div>
  );
}
