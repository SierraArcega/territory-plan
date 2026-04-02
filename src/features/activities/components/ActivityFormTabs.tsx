"use client";

import { useState } from "react";
import TaskLineItems, { type TaskDraft } from "./event-fields/TaskLineItems";
import ExpenseLineItems from "./event-fields/ExpenseLineItems";
import RelatedActivitiesTab, { type RelationDraft } from "./tabs/RelatedActivitiesTab";
import FilesTab from "./tabs/FilesTab";
import StarRating from "./StarRating";
import OpportunitySearch from "./OpportunitySearch";
import ContactSelect, { type SelectedContact } from "./event-fields/ContactSelect";
import {
  OUTCOMES_BY_CATEGORY,
  OUTCOME_CONFIGS,
  type OutcomeType,
} from "@/features/activities/outcome-types";
import type { OpportunityResult } from "@/features/activities/lib/outcome-types-api";
import type { ActivityCategory } from "@/features/activities/types";

type TabKey = "tasks" | "expenses" | "related" | "outcomes" | "files";

const TABS: { key: TabKey; label: string; icon: string }[] = [
  { key: "expenses", label: "Expenses", icon: "M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" },
  { key: "tasks", label: "Tasks", icon: "M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" },
  { key: "related", label: "Related Activities", icon: "M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" },
  { key: "outcomes", label: "Outcomes", icon: "M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" },
  { key: "files", label: "Files", icon: "M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z" },
];

interface ActivityFormTabsProps {
  taskDrafts: TaskDraft[];
  onTaskDraftsChange: (tasks: TaskDraft[]) => void;
  expenses: { description: string; amount: number }[];
  onExpensesChange: (expenses: { description: string; amount: number }[]) => void;
  relatedActivities: RelationDraft[];
  onRelatedActivitiesChange: (relations: RelationDraft[]) => void;
  showExpenses: boolean;
  onViewActivity?: (activityId: string, title: string) => void;
  // Outcomes (optional — only passed from create form)
  outcomeRating?: number;
  onOutcomeRatingChange?: (rating: number) => void;
  selectedOutcomes?: OutcomeType[];
  onSelectedOutcomesChange?: (outcomes: OutcomeType[]) => void;
  outcomeNote?: string;
  onOutcomeNoteChange?: (note: string) => void;
  activityCategory?: ActivityCategory | null;
  linkedOpportunities?: OpportunityResult[];
  onLinkedOpportunitiesChange?: (opps: OpportunityResult[]) => void;
  outcomeContacts?: SelectedContact[];
  onOutcomeContactsChange?: (contacts: SelectedContact[]) => void;
}

export default function ActivityFormTabs({
  taskDrafts,
  onTaskDraftsChange,
  expenses,
  onExpensesChange,
  relatedActivities,
  onRelatedActivitiesChange,
  showExpenses,
  onViewActivity,
  outcomeRating,
  onOutcomeRatingChange,
  selectedOutcomes,
  onSelectedOutcomesChange,
  outcomeNote,
  onOutcomeNoteChange,
  activityCategory,
  linkedOpportunities,
  onLinkedOpportunitiesChange,
  outcomeContacts,
  onOutcomeContactsChange,
}: ActivityFormTabsProps) {
  const [activeTab, setActiveTab] = useState<TabKey>("expenses");

  const hasOutcomes = onOutcomeRatingChange != null;
  const outcomeCount = ((outcomeRating ?? 0) > 0 ? 1 : 0) + (selectedOutcomes?.length ?? 0);
  const visibleTabs = hasOutcomes ? TABS : TABS.filter((t) => t.key !== "outcomes");

  return (
    <div className="flex flex-col h-full">
      {/* Tab strip */}
      <div className="flex border-b border-[#E2DEEC] px-2">
        {visibleTabs.map((tab) => {
          const isActive = activeTab === tab.key;
          const count =
            tab.key === "tasks" ? taskDrafts.length :
            tab.key === "expenses" ? expenses.length :
            tab.key === "related" ? relatedActivities.length :
            tab.key === "outcomes" ? outcomeCount :
            0;

          return (
            <button
              key={tab.key}
              type="button"
              onClick={() => setActiveTab(tab.key)}
              className={`flex items-center gap-1.5 px-3 py-2.5 text-xs font-medium transition-colors border-b-2 -mb-px ${
                isActive
                  ? "border-[#403770] text-[#403770]"
                  : "border-transparent text-[#A69DC0] hover:text-[#6E6390]"
              }`}
            >
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d={tab.icon} />
              </svg>
              {tab.label}
              {count > 0 && (
                <span className={`min-w-[16px] h-4 px-1 rounded-full text-[10px] font-bold flex items-center justify-center ${
                  isActive ? "bg-[#403770] text-white" : "bg-[#F7F5FA] text-[#8A80A8]"
                }`}>
                  {count}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* Tab content */}
      <div className="flex-1 overflow-y-auto p-4">
        {activeTab === "tasks" && (
          <TaskLineItems tasks={taskDrafts} onChange={onTaskDraftsChange} />
        )}
        {activeTab === "expenses" && (
          showExpenses ? (
            <ExpenseLineItems expenses={expenses} onChange={onExpensesChange} />
          ) : (
            <div className="text-center py-6">
              <p className="text-sm text-[#A69DC0]">Expenses not applicable for this activity type</p>
            </div>
          )
        )}
        {activeTab === "related" && (
          <RelatedActivitiesTab relations={relatedActivities} onChange={onRelatedActivitiesChange} onViewActivity={onViewActivity} />
        )}
        {activeTab === "outcomes" && hasOutcomes && (
          <div className="space-y-4">
            <div>
              <label className="block text-xs font-medium text-[#8A80A8] mb-1.5">Rating</label>
              <StarRating value={outcomeRating ?? 0} onChange={onOutcomeRatingChange} />
            </div>
            {activityCategory && OUTCOMES_BY_CATEGORY[activityCategory] && (
              <div>
                <label className="block text-xs font-medium text-[#8A80A8] mb-2">What happened?</label>
                <div className="flex flex-wrap gap-2">
                  {OUTCOMES_BY_CATEGORY[activityCategory].map((outcomeKey) => {
                    const config = OUTCOME_CONFIGS[outcomeKey];
                    const isSelected = (selectedOutcomes ?? []).includes(outcomeKey);
                    return (
                      <button
                        key={outcomeKey}
                        type="button"
                        onClick={() => {
                          onSelectedOutcomesChange?.(
                            isSelected
                              ? (selectedOutcomes ?? []).filter((o) => o !== outcomeKey)
                              : [...(selectedOutcomes ?? []), outcomeKey]
                          );
                        }}
                        className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all duration-100 ${
                          isSelected
                            ? "ring-2 ring-offset-1 scale-[1.02]"
                            : "hover:scale-[1.02]"
                        }`}
                        style={{
                          backgroundColor: config.bgColor,
                          color: config.color,
                          ...(isSelected ? { outlineColor: config.color } : {}),
                        }}
                        title={config.description}
                      >
                        <span>{config.icon}</span>
                        {config.label}
                      </button>
                    );
                  })}
                </div>
              </div>
            )}
            <div>
              <label className="block text-xs font-medium text-[#8A80A8] mb-1">Notes</label>
              <textarea
                value={outcomeNote ?? ""}
                onChange={(e) => onOutcomeNoteChange?.(e.target.value)}
                placeholder="What resulted from this activity?"
                rows={3}
                className="w-full px-3 py-2 border border-[#C2BBD4] rounded-lg text-sm text-[#403770] placeholder:text-[#A69DC0] focus:outline-none focus:ring-2 focus:ring-[#F37167] focus:border-transparent resize-none"
              />
            </div>

            {/* Opportunity linking */}
            {onLinkedOpportunitiesChange && (
              <OpportunitySearch
                value={linkedOpportunities ?? []}
                onChange={onLinkedOpportunitiesChange}
              />
            )}

            {/* Contacts from this activity */}
            {onOutcomeContactsChange && (
              <ContactSelect
                selectedContacts={outcomeContacts ?? []}
                onChange={onOutcomeContactsChange}
              />
            )}
          </div>
        )}
        {activeTab === "files" && <FilesTab />}
      </div>
    </div>
  );
}
