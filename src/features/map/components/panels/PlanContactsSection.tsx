"use client";

import { useMemo } from "react";
import { useMapV2Store } from "@/features/map/lib/store";
import { usePlanContacts, useTerritoryPlan } from "@/lib/api";
import type { Contact } from "@/lib/api";

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

interface DistrictGroup {
  leaid: string;
  name: string;
  contacts: Contact[];
}

export default function PlanContactsSection() {
  const activePlanId = useMapV2Store((s) => s.activePlanId);
  const openRightPanel = useMapV2Store((s) => s.openRightPanel);

  const { data: contacts, isLoading: isLoadingContacts } =
    usePlanContacts(activePlanId);
  const { data: plan, isLoading: isLoadingPlan } =
    useTerritoryPlan(activePlanId);

  // Group contacts by district, preserving order of plan districts
  const { districtsWithContacts, districtsWithoutContacts, totalContacts } =
    useMemo(() => {
      if (!contacts || !plan?.districts) {
        return {
          districtsWithContacts: [] as DistrictGroup[],
          districtsWithoutContacts: [] as { leaid: string; name: string }[],
          totalContacts: 0,
        };
      }

      // Group contacts by leaid
      const byLeaid = new Map<string, Contact[]>();
      for (const c of contacts) {
        const list = byLeaid.get(c.leaid) || [];
        list.push(c);
        byLeaid.set(c.leaid, list);
      }

      // Sort contacts within each group: primary first, then alphabetical
      for (const [, list] of byLeaid) {
        list.sort((a, b) => {
          if (a.isPrimary && !b.isPrimary) return -1;
          if (!a.isPrimary && b.isPrimary) return 1;
          return a.name.localeCompare(b.name);
        });
      }

      const withContacts: DistrictGroup[] = [];
      const withoutContacts: { leaid: string; name: string }[] = [];

      for (const d of plan.districts) {
        const cList = byLeaid.get(d.leaid);
        if (cList && cList.length > 0) {
          withContacts.push({
            leaid: d.leaid,
            name: d.name,
            contacts: cList,
          });
        } else {
          withoutContacts.push({ leaid: d.leaid, name: d.name });
        }
      }

      return {
        districtsWithContacts: withContacts,
        districtsWithoutContacts: withoutContacts,
        totalContacts: contacts.length,
      };
    }, [contacts, plan]);

  const isLoading = isLoadingContacts || isLoadingPlan;

  if (isLoading) {
    return <LoadingSkeleton />;
  }

  // Empty state: no contacts across all districts
  if (totalContacts === 0) {
    return (
      <div className="p-3 text-center py-12">
        <div className="w-10 h-10 mx-auto mb-3 rounded-full bg-gray-100 flex items-center justify-center">
          <svg
            width="18"
            height="18"
            viewBox="0 0 16 16"
            fill="none"
            className="text-gray-300"
          >
            <path
              d="M8 7C9.1 7 10 6.1 10 5S9.1 3 8 3 6 3.9 6 5 6.9 7 8 7ZM4 13C4 11.3 5.8 10 8 10S12 11.3 12 13"
              stroke="currentColor"
              strokeWidth="1.5"
              strokeLinecap="round"
              strokeLinejoin="round"
              fill="none"
            />
          </svg>
        </div>
        <p className="text-xs font-medium text-gray-500 mb-1">
          No contacts yet
        </p>
        <p className="text-[10px] text-gray-400 leading-relaxed">
          Contacts added to plan districts will appear here.
        </p>
      </div>
    );
  }

  return (
    <div className="p-3 space-y-3">
      {/* Summary */}
      <div className="text-[10px] text-gray-400">
        {totalContacts} contact{totalContacts !== 1 ? "s" : ""} across{" "}
        {districtsWithContacts.length} district
        {districtsWithContacts.length !== 1 ? "s" : ""}
      </div>

      {/* District groups with contacts */}
      {districtsWithContacts.map((group) => (
        <div key={group.leaid}>
          {/* District header */}
          <div className="text-[10px] font-medium text-gray-400 uppercase tracking-wider mb-1.5">
            {group.name}
          </div>

          {/* Contact rows */}
          <div className="space-y-0.5">
            {group.contacts.map((contact) => (
              <ContactRow
                key={contact.id}
                contact={contact}
                onClick={() =>
                  openRightPanel({
                    type: "contact_detail",
                    id: String(contact.id),
                  })
                }
              />
            ))}
          </div>
        </div>
      ))}

      {/* Districts without contacts */}
      {districtsWithoutContacts.length > 0 && (
        <div className="pt-2 border-t border-gray-100">
          <div className="text-[10px] text-gray-300 mb-1">
            {districtsWithoutContacts.length} district
            {districtsWithoutContacts.length !== 1 ? "s" : ""} with no contacts
          </div>
          <div className="space-y-0.5">
            {districtsWithoutContacts.map((d) => (
              <div
                key={d.leaid}
                className="text-[10px] text-gray-300 px-2 py-1 truncate"
              >
                {d.name}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function ContactRow({
  contact,
  onClick,
}: {
  contact: Contact;
  onClick: () => void;
}) {
  const initials = getInitials(contact.name);

  return (
    <button
      onClick={onClick}
      className="w-full group flex items-start gap-2 px-2 py-2 rounded-xl text-left hover:bg-gray-50 transition-colors"
    >
      {/* Avatar circle */}
      <div className="w-7 h-7 rounded-full bg-gray-200 flex items-center justify-center shrink-0">
        <span className="text-[9px] font-semibold text-gray-500">
          {initials}
        </span>
      </div>

      {/* Name + title */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-1">
          <span className="text-xs font-medium text-gray-700 truncate">
            {contact.name}
          </span>
          {contact.isPrimary && (
            <svg
              width="10"
              height="10"
              viewBox="0 0 12 12"
              fill="none"
              className="shrink-0"
            >
              <path
                d="M6 1L7.5 4.1L11 4.6L8.5 7L9.1 10.5L6 8.9L2.9 10.5L3.5 7L1 4.6L4.5 4.1L6 1Z"
                fill="#F59E0B"
                stroke="#F59E0B"
                strokeWidth="0.5"
                strokeLinejoin="round"
              />
            </svg>
          )}
        </div>
        {contact.title && (
          <p className="text-[10px] text-gray-400 truncate mt-0.5">
            {contact.title}
          </p>
        )}
      </div>

      {/* Quick-action icons on hover */}
      <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity shrink-0 mt-0.5">
        {contact.email && (
          <a
            href={`mailto:${contact.email}`}
            onClick={(e) => e.stopPropagation()}
            className="w-6 h-6 rounded-lg flex items-center justify-center hover:bg-gray-200 transition-colors"
            title={contact.email}
          >
            <svg
              width="12"
              height="12"
              viewBox="0 0 16 16"
              fill="none"
              className="text-gray-400"
            >
              <path
                d="M2 4L8 9L14 4M2 4V12H14V4"
                stroke="currentColor"
                strokeWidth="1.5"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </a>
        )}
        {contact.phone && (
          <a
            href={`tel:${contact.phone}`}
            onClick={(e) => e.stopPropagation()}
            className="w-6 h-6 rounded-lg flex items-center justify-center hover:bg-gray-200 transition-colors"
            title={contact.phone}
          >
            <svg
              width="12"
              height="12"
              viewBox="0 0 16 16"
              fill="none"
              className="text-gray-400"
            >
              <path
                d="M3 2.5C3 2.2 3.2 2 3.5 2H6L7.5 5.5L5.5 7C6.5 9 7 9.5 9 10.5L10.5 8.5L14 10V12.5C14 12.8 13.8 13 13.5 13C7.5 13 3 8.5 3 2.5Z"
                stroke="currentColor"
                strokeWidth="1.5"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </a>
        )}
      </div>
    </button>
  );
}

function LoadingSkeleton() {
  return (
    <div className="p-3 space-y-3">
      {/* Summary skeleton */}
      <div className="h-3 bg-gray-100 rounded w-32 animate-pulse" />

      {/* District group skeletons */}
      {[0, 1].map((g) => (
        <div key={g}>
          <div className="h-2.5 bg-gray-100 rounded w-24 mb-2 animate-pulse" />
          <div className="space-y-1">
            {[0, 1, 2].map((i) => (
              <div key={i} className="flex items-center gap-2 px-2 py-2">
                <div className="w-7 h-7 rounded-full bg-gray-100 animate-pulse shrink-0" />
                <div className="flex-1 space-y-1">
                  <div className="h-3 bg-gray-100 rounded w-2/3 animate-pulse" />
                  <div className="h-2.5 bg-gray-50 rounded w-1/2 animate-pulse" />
                </div>
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
