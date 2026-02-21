"use client";

// PlanDistrictPanel - Sliding right panel that shows full district details
// when a district or contact is clicked from within the plan view.
// Uses the shared tabbed layout (Planning/Signals/Schools/Contacts).

import { useEffect, useState } from "react";
import { useDistrictDetail } from "@/lib/api";
import DistrictHeader from "@/components/panel/DistrictHeader";
import DistrictTabStrip, {
  type DistrictTab,
} from "@/features/map/components/panels/district/tabs/DistrictTabStrip";
import PlanningTab from "@/features/map/components/panels/district/tabs/PlanningTab";
import SignalsTab from "@/features/map/components/panels/district/tabs/SignalsTab";
import SchoolsTab from "@/features/map/components/panels/district/tabs/SchoolsTab";
import ContactsTab from "@/features/map/components/panels/district/ContactsTab";

interface PlanDistrictPanelProps {
  leaid: string;
  planId: string;
  planColor: string;
  // If opened from contacts tab, highlight this contact
  highlightContactId?: number | null;
  onClose: () => void;
}

export default function PlanDistrictPanel({
  leaid,
  planId,
  planColor: _planColor,
  highlightContactId,
  onClose,
}: PlanDistrictPanelProps) {
  const [activeTab, setActiveTab] = useState<DistrictTab>("planning");

  // When panel opens with a highlighted contact, switch to contacts tab
  useEffect(() => {
    if (highlightContactId) {
      setActiveTab("contacts");
    }
  }, [highlightContactId]);

  // Reset tab when district changes
  useEffect(() => {
    setActiveTab(highlightContactId ? "contacts" : "planning");
  }, [leaid, highlightContactId]);

  const { data, isLoading, error } = useDistrictDetail(leaid);

  // Close on Escape key
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [onClose]);

  const contacts = data?.contacts || [];

  return (
    <div className="fixed top-0 right-0 h-full w-[420px] bg-white shadow-xl z-40 flex flex-col overflow-hidden panel-slide-in border-l border-gray-200">
      {/* Close button */}
      <button
        onClick={onClose}
        className="absolute top-4 right-4 w-8 h-8 flex items-center justify-center rounded-full hover:bg-gray-100 text-gray-500 hover:text-[#403770] z-10"
        aria-label="Close panel"
      >
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
        </svg>
      </button>

      {/* Content */}
      {isLoading ? (
        <div className="flex-1 flex items-center justify-center">
          <div className="animate-spin rounded-full h-8 w-8 border-2 border-[#F37167] border-t-transparent" />
        </div>
      ) : error ? (
        <div className="flex-1 flex items-center justify-center p-4">
          <div className="text-center text-red-500">
            <p className="font-medium">Error loading district</p>
            <p className="text-sm mt-1">{error.message}</p>
          </div>
        </div>
      ) : data ? (
        <div className="flex-1 flex flex-col overflow-hidden">
          {/* District Header */}
          <DistrictHeader
            district={data.district}
            fullmindData={data.fullmindData}
            tags={data.tags}
          />

          {/* Tab strip */}
          <DistrictTabStrip
            activeTab={activeTab}
            onSelect={setActiveTab}
            contactCount={contacts.length}
            showPlanning
          />

          {/* Tab content */}
          <div className="flex-1 overflow-y-auto min-h-0">
            {activeTab === "planning" && (
              <PlanningTab data={data} leaid={leaid} planId={planId} />
            )}
            {activeTab === "signals" && (
              <SignalsTab data={data} leaid={leaid} />
            )}
            {activeTab === "schools" && (
              <SchoolsTab leaid={leaid} />
            )}
            {activeTab === "contacts" && (
              <ContactsTab leaid={leaid} contacts={contacts} />
            )}
          </div>
        </div>
      ) : null}
    </div>
  );
}
