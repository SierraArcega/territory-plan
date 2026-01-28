"use client";

import { useState } from "react";
import {
  useCreateContact,
  useUpdateContact,
  useDeleteContact,
  type Contact,
} from "@/lib/api";

interface ContactsListProps {
  leaid: string;
  contacts: Contact[];
}

interface ContactFormData {
  name: string;
  title: string;
  email: string;
  phone: string;
  isPrimary: boolean;
}

const emptyForm: ContactFormData = {
  name: "",
  title: "",
  email: "",
  phone: "",
  isPrimary: false,
};

export default function ContactsList({ leaid, contacts }: ContactsListProps) {
  const [isAdding, setIsAdding] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [formData, setFormData] = useState<ContactFormData>(emptyForm);

  const createMutation = useCreateContact();
  const updateMutation = useUpdateContact();
  const deleteMutation = useDeleteContact();

  const handleStartAdd = () => {
    setIsAdding(true);
    setEditingId(null);
    setFormData(emptyForm);
  };

  const handleStartEdit = (contact: Contact) => {
    setEditingId(contact.id);
    setIsAdding(false);
    setFormData({
      name: contact.name,
      title: contact.title || "",
      email: contact.email || "",
      phone: contact.phone || "",
      isPrimary: contact.isPrimary,
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

  const isPending =
    createMutation.isPending ||
    updateMutation.isPending ||
    deleteMutation.isPending;

  return (
    <div>
      <div className="flex justify-between items-center mb-3">
        <h3 className="text-sm font-bold text-[#403770]">Contacts</h3>
        {!isAdding && !editingId && (
          <button
            onClick={handleStartAdd}
            className="text-xs text-[#F37167] hover:text-[#403770] font-medium"
          >
            + Add Contact
          </button>
        )}
      </div>

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
                        {contact.name}
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
                        className="text-sm text-[#6EA3BE] hover:underline"
                      >
                        {contact.email}
                      </a>
                    )}
                    {contact.phone && (
                      <p className="text-sm text-gray-600">{contact.phone}</p>
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
      <input
        type="text"
        value={formData.name}
        onChange={(e) => setFormData({ ...formData, name: e.target.value })}
        placeholder="Name *"
        className="w-full px-2 py-1.5 text-sm border border-gray-200 rounded-md focus:outline-none focus:ring-2 focus:ring-[#F37167] focus:border-transparent"
      />
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
