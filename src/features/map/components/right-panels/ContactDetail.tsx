"use client";

import { useState, useMemo } from "react";
import { useMapV2Store } from "@/features/map/lib/store";
import { usePlanContacts, useDeleteContact } from "@/lib/api";

/** Extract initials from a full name (e.g. "Jane Doe" -> "JD") */
function getInitials(name: string): string {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .map((w) => w[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);
}

interface ContactDetailProps {
  contactId: string;
}

export default function ContactDetail({ contactId }: ContactDetailProps) {
  const activePlanId = useMapV2Store((s) => s.activePlanId);
  const closeRightPanel = useMapV2Store((s) => s.closeRightPanel);
  const openRightPanel = useMapV2Store((s) => s.openRightPanel);

  const { data: contacts, isLoading } = usePlanContacts(activePlanId);
  const deleteContact = useDeleteContact();

  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  // Find the contact by ID from the plan contacts list
  const contact = useMemo(() => {
    if (!contacts) return null;
    return contacts.find((c) => String(c.id) === contactId) ?? null;
  }, [contacts, contactId]);

  if (isLoading) {
    return <LoadingSkeleton />;
  }

  if (!contact) {
    return (
      <div className="text-center py-8 text-xs text-gray-400">
        Contact not found
      </div>
    );
  }

  const initials = getInitials(contact.name);

  const handleDelete = async () => {
    try {
      await deleteContact.mutateAsync({
        id: contact.id,
        leaid: contact.leaid,
      });
      closeRightPanel();
    } catch {
      // Error handled by react-query
    }
  };

  // Build info rows -- only display rows that have values
  const infoRows: { label: string; value: React.ReactNode }[] = [];

  if (contact.email) {
    infoRows.push({
      label: "Email",
      value: (
        <a
          href={`mailto:${contact.email}`}
          className="text-xs text-blue-600 hover:underline break-all"
        >
          {contact.email}
        </a>
      ),
    });
  }

  if (contact.phone) {
    infoRows.push({
      label: "Phone",
      value: (
        <a
          href={`tel:${contact.phone}`}
          className="text-xs text-blue-600 hover:underline"
        >
          {contact.phone}
        </a>
      ),
    });
  }

  if (contact.linkedinUrl) {
    infoRows.push({
      label: "LinkedIn",
      value: (
        <a
          href={contact.linkedinUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="text-xs text-blue-600 hover:underline flex items-center gap-1"
        >
          Profile
          <svg
            width="10"
            height="10"
            viewBox="0 0 12 12"
            fill="none"
            className="shrink-0"
          >
            <path
              d="M4 2H2V10H10V8M7 2H10V5M10 2L5 7"
              stroke="currentColor"
              strokeWidth="1.2"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </a>
      ),
    });
  }

  if (contact.persona) {
    infoRows.push({
      label: "Persona",
      value: <span className="text-xs text-gray-700">{contact.persona}</span>,
    });
  }

  if (contact.seniorityLevel) {
    infoRows.push({
      label: "Seniority",
      value: (
        <span className="text-xs text-gray-700">{contact.seniorityLevel}</span>
      ),
    });
  }

  return (
    <div className="space-y-4">
      {/* Avatar + Name header */}
      <div className="flex items-start gap-3">
        <div className="w-10 h-10 rounded-full bg-plum/10 text-plum flex items-center justify-center shrink-0">
          <span className="text-xs font-semibold">{initials}</span>
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5">
            <h3 className="text-sm font-semibold text-gray-800 truncate">
              {contact.name}
            </h3>
            {contact.isPrimary && (
              <span className="shrink-0 inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-full bg-amber-50 text-amber-600 text-[9px] font-medium">
                <svg
                  width="8"
                  height="8"
                  viewBox="0 0 12 12"
                  fill="none"
                >
                  <path
                    d="M6 1L7.5 4.1L11 4.6L8.5 7L9.1 10.5L6 8.9L2.9 10.5L3.5 7L1 4.6L4.5 4.1L6 1Z"
                    fill="#F59E0B"
                    stroke="#F59E0B"
                    strokeWidth="0.5"
                    strokeLinejoin="round"
                  />
                </svg>
                Primary
              </span>
            )}
          </div>
          {contact.title && (
            <p className="text-[10px] text-gray-400 mt-0.5">{contact.title}</p>
          )}
        </div>
      </div>

      {/* Info rows */}
      {infoRows.length > 0 && (
        <div className="space-y-2">
          {infoRows.map((row) => (
            <div key={row.label}>
              <div className="text-[9px] font-medium text-gray-400 uppercase tracking-wider mb-0.5">
                {row.label}
              </div>
              {row.value}
            </div>
          ))}
        </div>
      )}

      {/* No info fallback */}
      {infoRows.length === 0 && (
        <div className="rounded-lg bg-gray-50 px-3 py-2.5">
          <p className="text-[10px] text-gray-400">
            No contact details available.
          </p>
        </div>
      )}

      {/* Quick actions */}
      <div className="space-y-1.5 pt-1 border-t border-gray-100">
        <button
          onClick={() =>
            openRightPanel({ type: "task_form", id: contact.leaid })
          }
          className="w-full flex items-center gap-2 px-3 py-2 rounded-xl text-left hover:bg-gray-50 transition-colors text-xs font-medium text-gray-600"
        >
          <svg
            width="14"
            height="14"
            viewBox="0 0 16 16"
            fill="none"
            className="shrink-0 text-gray-400"
          >
            <path
              d="M3 4H5V6H3V4ZM7 4.5H13M3 8H5V10H3V8ZM7 8.5H13"
              stroke="currentColor"
              strokeWidth="1.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
          Add Task
        </button>
      </div>

      {/* Delete section */}
      <div className="pt-1">
        {!showDeleteConfirm ? (
          <button
            onClick={() => setShowDeleteConfirm(true)}
            className="w-full flex items-center gap-2 px-3 py-2 rounded-xl text-left text-red-500 hover:bg-red-50 transition-colors text-xs font-medium"
          >
            <svg
              width="14"
              height="14"
              viewBox="0 0 16 16"
              fill="none"
              className="shrink-0"
            >
              <path
                d="M3 5H13M5 5V3C5 2.4 5.4 2 6 2H10C10.6 2 11 2.4 11 3V5M6 8V12M10 8V12M4 5L5 14H11L12 5"
                stroke="currentColor"
                strokeWidth="1.5"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
            Delete Contact
          </button>
        ) : (
          <div className="rounded-xl bg-red-50 border border-red-200 p-3 space-y-2">
            <p className="text-xs text-red-600 font-medium">
              Delete this contact permanently?
            </p>
            <div className="flex gap-2">
              <button
                onClick={handleDelete}
                disabled={deleteContact.isPending}
                className="flex-1 py-1.5 bg-red-500 text-white text-xs font-medium rounded-lg hover:bg-red-600 transition-colors disabled:opacity-50"
              >
                {deleteContact.isPending ? "Deleting..." : "Delete"}
              </button>
              <button
                onClick={() => setShowDeleteConfirm(false)}
                className="flex-1 py-1.5 bg-white text-gray-600 text-xs font-medium rounded-lg border border-gray-200 hover:bg-gray-50 transition-colors"
              >
                Cancel
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function LoadingSkeleton() {
  return (
    <div className="space-y-4">
      {/* Avatar + name skeleton */}
      <div className="flex items-start gap-3">
        <div className="w-10 h-10 rounded-full bg-gray-100 animate-pulse shrink-0" />
        <div className="flex-1 space-y-1.5">
          <div className="h-4 bg-gray-200 rounded w-2/3 animate-pulse" />
          <div className="h-3 bg-gray-100 rounded w-1/2 animate-pulse" />
        </div>
      </div>
      {/* Info rows skeleton */}
      <div className="space-y-3">
        {[0, 1, 2].map((i) => (
          <div key={i}>
            <div className="h-2 bg-gray-100 rounded w-12 mb-1 animate-pulse" />
            <div className="h-3 bg-gray-100 rounded w-3/4 animate-pulse" />
          </div>
        ))}
      </div>
      {/* Action skeleton */}
      <div className="h-9 bg-gray-50 rounded-xl animate-pulse" />
    </div>
  );
}
