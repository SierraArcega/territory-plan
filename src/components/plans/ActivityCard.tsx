"use client";

import { useState } from "react";
import {
  type PlanActivity,
  type PlanActivityType,
  ACTIVITY_TYPE_LABELS,
  ACTIVITY_STATUS_CONFIG,
} from "@/lib/api";

// Icons for each activity type
const ACTIVITY_ICONS: Record<PlanActivityType, string> = {
  email_campaign: "📧",
  in_person_visit: "🏢",
  sales_meeting: "🤝",
  conference: "🎤",
  phone_call: "📞",
};

interface ActivityCardProps {
  activity: PlanActivity;
  onEdit: () => void;
  onDelete: () => void;
  isDeleting?: boolean;
}

export default function ActivityCard({
  activity,
  onEdit,
  onDelete,
  isDeleting = false,
}: ActivityCardProps) {
  const [showNotes, setShowNotes] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  const statusConfig = ACTIVITY_STATUS_CONFIG[activity.status];
  const typeLabel = ACTIVITY_TYPE_LABELS[activity.type];
  const typeIcon = ACTIVITY_ICONS[activity.type];

  // Format date nicely
  const formattedDate = new Date(activity.activityDate).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });

  // Determine if activity is in the past or future
  const activityDate = new Date(activity.activityDate);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const isPast = activityDate < today;
  const isToday = activityDate.toDateString() === today.toDateString();

  // Scope display text
  const scopeText = activity.districtLeaid
    ? `${activity.districtName}${activity.districtState ? ` (${activity.districtState})` : ""}`
    : "All districts";

  return (
    <div className="bg-white rounded-lg border border-gray-200 p-4 hover:border-gray-300 transition-colors">
      {/* Header row: icon, title, status */}
      <div className="flex items-start justify-between gap-3 mb-2">
        <div className="flex items-start gap-3 min-w-0">
          <span className="text-xl flex-shrink-0">{typeIcon}</span>
          <div className="min-w-0">
            <h4 className="font-medium text-[#403770] truncate">{activity.title}</h4>
            <p className="text-xs text-gray-500">{typeLabel}</p>
          </div>
        </div>
        <span
          className="px-2 py-0.5 text-xs font-medium rounded-full flex-shrink-0"
          style={{ backgroundColor: statusConfig.bgColor, color: statusConfig.color }}
        >
          {statusConfig.label}
        </span>
      </div>

      {/* Date and scope row */}
      <div className="flex items-center gap-3 text-sm text-gray-600 mb-3">
        <span className={`${isToday ? "text-[#F37167] font-medium" : isPast ? "text-gray-400" : ""}`}>
          {isToday ? "Today" : formattedDate}
        </span>
        <span className="text-gray-300">•</span>
        <span className="truncate">{scopeText}</span>
      </div>

      {/* Contacts (if any) */}
      {activity.contacts.length > 0 && (
        <div className="flex items-center gap-1.5 mb-3 flex-wrap">
          <svg className="w-4 h-4 text-gray-400 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />
          </svg>
          {activity.contacts.map((contact, idx) => (
            <span key={contact.id} className="text-xs text-gray-600">
              {contact.name}
              {idx < activity.contacts.length - 1 && ","}
            </span>
          ))}
        </div>
      )}

      {/* Notes preview (truncated) */}
      {activity.notes && (
        <div className="mb-3">
          <button
            onClick={() => setShowNotes(!showNotes)}
            className="text-xs text-gray-500 hover:text-[#403770] flex items-center gap-1"
          >
            <svg
              className={`w-3 h-3 transition-transform ${showNotes ? "rotate-90" : ""}`}
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
            </svg>
            {showNotes ? "Hide notes" : "Show notes"}
          </button>
          {showNotes && (
            <p className="mt-2 text-sm text-gray-600 bg-gray-50 rounded-lg p-2 whitespace-pre-wrap">
              {activity.notes}
            </p>
          )}
        </div>
      )}

      {/* Actions row */}
      <div className="flex items-center justify-end gap-2 pt-2 border-t border-gray-100">
        <button
          onClick={onEdit}
          className="inline-flex items-center gap-1 px-2 py-1 text-xs text-gray-600 hover:text-[#403770] hover:bg-gray-100 rounded transition-colors"
        >
          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
          </svg>
          Edit
        </button>
        {showDeleteConfirm ? (
          <div className="flex items-center gap-1">
            <button
              onClick={() => setShowDeleteConfirm(false)}
              className="px-2 py-1 text-xs text-gray-600 hover:bg-gray-100 rounded transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={onDelete}
              disabled={isDeleting}
              className="px-2 py-1 text-xs text-white bg-red-500 hover:bg-red-600 rounded transition-colors disabled:opacity-50"
            >
              {isDeleting ? "..." : "Delete"}
            </button>
          </div>
        ) : (
          <button
            onClick={() => setShowDeleteConfirm(true)}
            className="inline-flex items-center gap-1 px-2 py-1 text-xs text-gray-600 hover:text-red-500 hover:bg-red-50 rounded transition-colors"
          >
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
            </svg>
            Delete
          </button>
        )}
      </div>
    </div>
  );
}
