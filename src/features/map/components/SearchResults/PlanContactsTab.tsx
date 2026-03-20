"use client";

import { usePlanContacts } from "@/lib/api";
import type { Contact } from "@/features/shared/types/api-types";

interface PlanContactsTabProps {
  planId: string;
}

export default function PlanContactsTab({ planId }: PlanContactsTabProps) {
  const { data: contacts, isLoading } = usePlanContacts(planId);

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

  if (!contacts || contacts.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-20 px-6 text-center">
        <svg className="w-9 h-9 text-[#C2BBD4] mb-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 19.128a9.38 9.38 0 002.625.372 9.337 9.337 0 004.121-.952 4.125 4.125 0 00-7.533-2.493M15 19.128v-.003c0-1.113-.285-2.16-.786-3.07M15 19.128v.106A12.318 12.318 0 018.624 21c-2.331 0-4.512-.645-6.374-1.766l-.001-.109a6.375 6.375 0 0111.964-3.07M12 6.375a3.375 3.375 0 11-6.75 0 3.375 3.375 0 016.75 0zm8.25 2.25a2.625 2.625 0 11-5.25 0 2.625 2.625 0 015.25 0z" />
        </svg>
        <p className="text-sm font-medium text-[#6E6390]">No contacts yet</p>
        <p className="text-xs text-[#A69DC0] mt-1">Contacts from districts in this plan will appear here.</p>
      </div>
    );
  }

  return (
    <div className="p-5 space-y-2">
      {contacts.map((contact) => (
        <div
          key={contact.id}
          className="flex items-center gap-3 p-3 rounded-lg border border-[#E2DEEC] hover:border-[#D4CFE2] hover:bg-[#FAFAFE] transition-colors"
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
              <span className="text-xs font-semibold text-[#544A78] truncate">{contact.name}</span>
              {contact.isPrimary && (
                <span className="px-1.5 py-0.5 rounded text-[9px] font-bold uppercase bg-[#403770]/8 text-[#403770]">
                  Primary
                </span>
              )}
            </div>
            {contact.title && (
              <p className="text-[11px] text-[#8A80A8] truncate mt-0.5">{contact.title}</p>
            )}
            {contact.leaid && (
              <p className="text-[10px] text-[#A69DC0] truncate mt-0.5">LEAID: {contact.leaid}</p>
            )}
          </div>

          {/* Actions */}
          <div className="flex items-center gap-1.5 shrink-0">
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
      ))}
    </div>
  );
}
