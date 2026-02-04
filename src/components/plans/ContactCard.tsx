"use client";

// ContactCard - Card view for contacts with persona badge and quick actions
// Follows Fullmind brand with clean design and coral/plum accents

import { useState } from "react";
import type { Contact } from "@/lib/api";
import {
  PERSONA_COLORS,
  SENIORITY_COLORS,
  type Persona,
  type SeniorityLevel,
} from "@/lib/contactTypes";

export default function ContactCard({ contact, onEdit, onDelete }: ContactCardProps) {
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  const personaColors = contact.persona ? PERSONA_COLORS[contact.persona as Persona] : null;
  const seniorityColors = contact.seniorityLevel ? SENIORITY_COLORS[contact.seniorityLevel as SeniorityLevel] : null;

  const handleDelete = () => {
    if (onDelete) {
      onDelete();
      setShowDeleteConfirm(false);
    }
  };

  return (
    <div
      className="group relative bg-white rounded-lg border border-gray-200 p-4 hover:shadow-md hover:border-[#C4E7E6] transition-all"
      style={{
        borderLeftWidth: contact.isPrimary ? "3px" : undefined,
        borderLeftColor: contact.isPrimary ? "#F37167" : undefined,
      }}
    >
      {/* Header: Name + Primary Badge */}
      <div className="flex items-start justify-between mb-2">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <h3 className="text-sm font-semibold text-[#403770] truncate">
              {contact.salutation ? `${contact.salutation} ` : ""}{contact.name}
            </h3>
            {contact.isPrimary && (
              <span className="flex-shrink-0 px-1.5 py-0.5 text-[10px] font-semibold bg-[#F37167] text-white rounded">
                PRIMARY
              </span>
            )}
          </div>
          {contact.title && (
            <p className="text-xs text-gray-500 truncate mt-0.5">
              {contact.title}
            </p>
          )}
        </div>

        {/* Actions dropdown trigger */}
        <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
          {contact.linkedinUrl && (
            <a
              href={contact.linkedinUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="p-1 text-[#0A66C2] hover:text-[#004182] transition-colors"
              aria-label="View LinkedIn profile"
            >
              <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
                <path d="M19 3a2 2 0 012 2v14a2 2 0 01-2 2H5a2 2 0 01-2-2V5a2 2 0 012-2h14m-.5 15.5v-5.3a3.26 3.26 0 00-3.26-3.26c-.85 0-1.84.52-2.32 1.3v-1.11h-2.79v8.37h2.79v-4.93c0-.77.62-1.4 1.39-1.4a1.4 1.4 0 011.4 1.4v4.93h2.79M6.88 8.56a1.68 1.68 0 001.68-1.68c0-.93-.75-1.69-1.68-1.69a1.69 1.69 0 00-1.69 1.69c0 .93.76 1.68 1.69 1.68m1.39 9.94v-8.37H5.5v8.37h2.77z" />
              </svg>
            </a>
          )}
          {onEdit && (
            <button
              onClick={onEdit}
              className="p-1 text-gray-400 hover:text-[#403770] transition-colors"
              aria-label="Edit contact"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
              </svg>
            </button>
          )}
          {onDelete && (
            <button
              onClick={() => setShowDeleteConfirm(true)}
              className="p-1 text-gray-400 hover:text-red-500 transition-colors"
              aria-label="Delete contact"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
              </svg>
            </button>
          )}
        </div>
      </div>

      {/* Contact Info */}
      <div className="space-y-1.5 mb-3">
        {contact.email && (
          <a
            href={`mailto:${contact.email}`}
            className="flex items-center gap-2 text-xs text-gray-600 hover:text-[#403770] transition-colors"
          >
            <svg className="w-3.5 h-3.5 text-gray-400 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
            </svg>
            <span className="truncate">{contact.email}</span>
          </a>
        )}
        {contact.phone && (
          <a
            href={`tel:${contact.phone}`}
            className="flex items-center gap-2 text-xs text-gray-600 hover:text-[#403770] transition-colors"
          >
            <svg className="w-3.5 h-3.5 text-gray-400 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
            </svg>
            <span>{contact.phone}</span>
          </a>
        )}
      </div>

      {/* Badges */}
      <div className="flex flex-wrap gap-1.5">
        {contact.persona && (
          <span
            className="inline-flex items-center px-2 py-0.5 text-[10px] font-medium rounded-full"
            style={{
              backgroundColor: personaColors?.bg || "#F3F4F6",
              color: personaColors?.text || "#6B7280",
              border: `1px solid ${personaColors?.border || "#E5E7EB"}`,
            }}
          >
            {contact.persona}
          </span>
        )}
        {contact.seniorityLevel && (
          <span
            className="inline-flex items-center px-2 py-0.5 text-[10px] font-medium rounded-full"
            style={{
              backgroundColor: seniorityColors?.bg || "#F3F4F6",
              color: seniorityColors?.text || "#6B7280",
            }}
          >
            {contact.seniorityLevel}
          </span>
        )}
      </div>

      {/* Inline Delete Confirmation */}
      {showDeleteConfirm && (
        <div className="absolute inset-0 bg-white/95 rounded-lg flex flex-col items-center justify-center p-4">
          <p className="text-sm text-gray-700 text-center mb-3">
            Delete this contact?
          </p>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setShowDeleteConfirm(false)}
              className="px-3 py-1.5 text-xs font-medium text-gray-700 bg-gray-100 hover:bg-gray-200 rounded transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={handleDelete}
              className="px-3 py-1.5 text-xs font-medium text-white bg-red-500 hover:bg-red-600 rounded transition-colors"
            >
              Delete
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
