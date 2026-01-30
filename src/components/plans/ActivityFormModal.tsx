"use client";

import { useState, useEffect } from "react";
import {
  type PlanActivityType,
  type PlanActivityStatus,
  type PlanActivity,
  type Contact,
  ACTIVITY_TYPE_LABELS,
} from "@/lib/api";

// Form data structure
export interface ActivityFormData {
  type: PlanActivityType;
  title: string;
  activityDate: string;
  status: PlanActivityStatus;
  districtLeaid: string | null;
  contactIds: number[];
  notes: string;
}

// District option for the dropdown
interface DistrictOption {
  leaid: string;
  name: string;
  stateAbbrev: string | null;
}

interface ActivityFormModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (data: ActivityFormData) => Promise<void>;
  // Available districts in this plan
  districts: DistrictOption[];
  // Contacts for the selected district (passed from parent)
  contacts?: Contact[];
  // Initial data for editing (optional)
  initialData?: PlanActivity | null;
  title?: string;
}

// Activity type options with icons
const ACTIVITY_TYPES: { value: PlanActivityType; label: string; icon: string }[] = [
  { value: "email_campaign", label: ACTIVITY_TYPE_LABELS.email_campaign, icon: "📧" },
  { value: "in_person_visit", label: ACTIVITY_TYPE_LABELS.in_person_visit, icon: "🏢" },
  { value: "sales_meeting", label: ACTIVITY_TYPE_LABELS.sales_meeting, icon: "🤝" },
  { value: "conference", label: ACTIVITY_TYPE_LABELS.conference, icon: "🎤" },
  { value: "phone_call", label: ACTIVITY_TYPE_LABELS.phone_call, icon: "📞" },
];

const STATUS_OPTIONS: { value: PlanActivityStatus; label: string }[] = [
  { value: "planned", label: "Planned" },
  { value: "completed", label: "Completed" },
  { value: "cancelled", label: "Cancelled" },
];

export default function ActivityFormModal({
  isOpen,
  onClose,
  onSubmit,
  districts,
  contacts = [],
  initialData,
  title = "Add Activity",
}: ActivityFormModalProps) {
  // Form state
  const [formData, setFormData] = useState<ActivityFormData>({
    type: "email_campaign",
    title: "",
    activityDate: new Date().toISOString().split("T")[0],
    status: "planned",
    districtLeaid: null,
    contactIds: [],
    notes: "",
  });

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Reset form when modal opens/closes or initialData changes
  useEffect(() => {
    if (isOpen) {
      if (initialData) {
        setFormData({
          type: initialData.type,
          title: initialData.title,
          activityDate: initialData.activityDate.split("T")[0],
          status: initialData.status,
          districtLeaid: initialData.districtLeaid,
          contactIds: initialData.contacts.map((c) => c.id),
          notes: initialData.notes || "",
        });
      } else {
        setFormData({
          type: "email_campaign",
          title: "",
          activityDate: new Date().toISOString().split("T")[0],
          status: "planned",
          districtLeaid: null,
          contactIds: [],
          notes: "",
        });
      }
      setError(null);
    }
  }, [isOpen, initialData]);

  // Clear contacts when district changes
  useEffect(() => {
    if (!formData.districtLeaid) {
      setFormData((prev) => ({ ...prev, contactIds: [] }));
    }
  }, [formData.districtLeaid]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setIsSubmitting(true);

    try {
      await onSubmit(formData);
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save activity");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleContactToggle = (contactId: number) => {
    setFormData((prev) => ({
      ...prev,
      contactIds: prev.contactIds.includes(contactId)
        ? prev.contactIds.filter((id) => id !== contactId)
        : [...prev.contactIds, contactId],
    }));
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/50" onClick={onClose} />

      {/* Modal */}
      <div className="relative bg-white rounded-xl shadow-2xl w-full max-w-lg mx-4 max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="px-6 py-4 border-b border-gray-200">
          <h2 className="text-lg font-semibold text-[#403770]">{title}</h2>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="p-6 space-y-5">
          {/* Activity Type */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Activity Type <span className="text-red-500">*</span>
            </label>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
              {ACTIVITY_TYPES.map((type) => (
                <button
                  key={type.value}
                  type="button"
                  onClick={() => setFormData((prev) => ({ ...prev, type: type.value }))}
                  className={`flex items-center gap-2 px-3 py-2 text-sm rounded-lg border transition-colors ${
                    formData.type === type.value
                      ? "border-[#403770] bg-[#403770]/5 text-[#403770]"
                      : "border-gray-200 hover:border-gray-300"
                  }`}
                >
                  <span>{type.icon}</span>
                  <span className="truncate">{type.label}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Title */}
          <div>
            <label htmlFor="activity-title" className="block text-sm font-medium text-gray-700 mb-1">
              Title <span className="text-red-500">*</span>
            </label>
            <input
              id="activity-title"
              type="text"
              required
              maxLength={255}
              value={formData.title}
              onChange={(e) => setFormData((prev) => ({ ...prev, title: e.target.value }))}
              placeholder="e.g., Q1 Intro Email Blast"
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#403770]/20 focus:border-[#403770] outline-none text-sm"
            />
          </div>

          {/* Date and Status row */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label htmlFor="activity-date" className="block text-sm font-medium text-gray-700 mb-1">
                Date <span className="text-red-500">*</span>
              </label>
              <input
                id="activity-date"
                type="date"
                required
                value={formData.activityDate}
                onChange={(e) => setFormData((prev) => ({ ...prev, activityDate: e.target.value }))}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#403770]/20 focus:border-[#403770] outline-none text-sm"
              />
            </div>
            <div>
              <label htmlFor="activity-status" className="block text-sm font-medium text-gray-700 mb-1">
                Status <span className="text-red-500">*</span>
              </label>
              <select
                id="activity-status"
                value={formData.status}
                onChange={(e) =>
                  setFormData((prev) => ({ ...prev, status: e.target.value as PlanActivityStatus }))
                }
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#403770]/20 focus:border-[#403770] outline-none text-sm"
              >
                {STATUS_OPTIONS.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Scope (District or All) */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Scope
            </label>
            <div className="space-y-2">
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="radio"
                  name="scope"
                  checked={formData.districtLeaid === null}
                  onChange={() => setFormData((prev) => ({ ...prev, districtLeaid: null, contactIds: [] }))}
                  className="text-[#403770] focus:ring-[#403770]"
                />
                <span className="text-sm">All districts in plan</span>
              </label>
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="radio"
                  name="scope"
                  checked={formData.districtLeaid !== null}
                  onChange={() =>
                    setFormData((prev) => ({
                      ...prev,
                      districtLeaid: districts[0]?.leaid || null,
                      contactIds: [],
                    }))
                  }
                  className="text-[#403770] focus:ring-[#403770]"
                />
                <span className="text-sm">Specific district</span>
              </label>
            </div>

            {/* District dropdown (shown when specific district is selected) */}
            {formData.districtLeaid !== null && (
              <select
                value={formData.districtLeaid || ""}
                onChange={(e) =>
                  setFormData((prev) => ({
                    ...prev,
                    districtLeaid: e.target.value || null,
                    contactIds: [],
                  }))
                }
                className="mt-2 w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#403770]/20 focus:border-[#403770] outline-none text-sm"
              >
                {districts.map((d) => (
                  <option key={d.leaid} value={d.leaid}>
                    {d.name} {d.stateAbbrev ? `(${d.stateAbbrev})` : ""}
                  </option>
                ))}
              </select>
            )}
          </div>

          {/* Contacts (shown when district is selected and contacts are available) */}
          {formData.districtLeaid && contacts.length > 0 && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Contacts Involved
              </label>
              <div className="space-y-1 max-h-32 overflow-y-auto border border-gray-200 rounded-lg p-2">
                {contacts.map((contact) => (
                  <label
                    key={contact.id}
                    className="flex items-center gap-2 p-1.5 rounded hover:bg-gray-50 cursor-pointer"
                  >
                    <input
                      type="checkbox"
                      checked={formData.contactIds.includes(contact.id)}
                      onChange={() => handleContactToggle(contact.id)}
                      className="rounded text-[#403770] focus:ring-[#403770]"
                    />
                    <span className="text-sm">{contact.name}</span>
                    {contact.title && (
                      <span className="text-xs text-gray-400">– {contact.title}</span>
                    )}
                  </label>
                ))}
              </div>
            </div>
          )}

          {/* Notes */}
          <div>
            <label htmlFor="activity-notes" className="block text-sm font-medium text-gray-700 mb-1">
              Notes
            </label>
            <textarea
              id="activity-notes"
              rows={3}
              value={formData.notes}
              onChange={(e) => setFormData((prev) => ({ ...prev, notes: e.target.value }))}
              placeholder="Add any additional details..."
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#403770]/20 focus:border-[#403770] outline-none text-sm resize-none"
            />
          </div>

          {/* Error message */}
          {error && (
            <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-600">
              {error}
            </div>
          )}

          {/* Actions */}
          <div className="flex justify-end gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-100 rounded-lg transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting || !formData.title.trim()}
              className="px-4 py-2 text-sm font-medium text-white bg-[#403770] hover:bg-[#352d5c] rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isSubmitting ? "Saving..." : initialData ? "Save Changes" : "Add Activity"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
