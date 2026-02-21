"use client";

// PlanTabs - Tabbed container for Districts, Activities, and Contacts
// Features: Tab navigation with dashed line accent, view toggle per tab,
// filter bar with saved views support

import { useState, useCallback, useEffect, useMemo } from "react";
import type { TerritoryPlanDistrict, ActivityListItem, Contact } from "@/lib/api";
import { useTasks } from "@/lib/api";
import { PERSONAS, SENIORITY_LEVELS } from "@/lib/contactTypes";
import ViewToggle from "@/components/common/ViewToggle";
import FilterBar, { type FilterConfig, type SavedView } from "./FilterBar";
import DistrictsTable from "./DistrictsTable";
import DistrictCard from "./DistrictCard";
import ActivitiesTable from "./ActivitiesTable";
import ActivityCard from "./ActivityCard";
import ContactsTable from "./ContactsTable";
import ContactCard from "./ContactCard";
import TaskList from "@/components/tasks/TaskList";

type TabId = "districts" | "activities" | "contacts" | "tasks";

interface Tab {
  id: TabId;
  label: string;
  count: number;
  icon: React.ReactNode;
}

interface PlanTabsProps {
  planId: string;
  districts: TerritoryPlanDistrict[];
  activities: ActivityListItem[];
  contacts: Contact[];
  onRemoveDistrict: (leaid: string) => void;
  isRemovingDistrict?: boolean;
  onEditActivity: (activity: ActivityListItem) => void;
  onDeleteActivity: (activityId: string) => void;
  isDeletingActivity?: boolean;
  onEditContact?: (contact: Contact) => void;
  onDeleteContact?: (contactId: number) => void;
  // Click handlers for opening the district detail panel
  onDistrictClick?: (leaid: string) => void;
  onContactClick?: (leaid: string, contactId: number) => void;
}

// Filter configurations per tab
const DISTRICT_FILTERS: FilterConfig[] = [
  {
    id: "state",
    label: "State",
    type: "select",
    options: [], // Populated dynamically
  },
  {
    id: "hasTarget",
    label: "Has Target",
    type: "select",
    options: [
      { value: "yes", label: "Yes" },
      { value: "no", label: "No" },
    ],
  },
  {
    id: "services",
    label: "Services",
    type: "multiselect",
    options: [], // Populated dynamically
  },
];

const ACTIVITY_FILTERS: FilterConfig[] = [
  {
    id: "status",
    label: "Status",
    type: "select",
    options: [
      { value: "planned", label: "Planned" },
      { value: "completed", label: "Completed" },
      { value: "cancelled", label: "Cancelled" },
    ],
  },
  {
    id: "type",
    label: "Type",
    type: "select",
    options: [
      { value: "conference", label: "Conference" },
      { value: "road_trip", label: "Road Trip" },
      { value: "trade_show", label: "Trade Show" },
      { value: "school_visit_day", label: "School Visit" },
      { value: "email_campaign", label: "Email Campaign" },
      { value: "phone_call", label: "Phone Call" },
      { value: "discovery_call", label: "Discovery Call" },
      { value: "demo", label: "Demo" },
    ],
  },
];

const CONTACT_FILTERS: FilterConfig[] = [
  {
    id: "persona",
    label: "Department",
    type: "select",
    options: PERSONAS.map(p => ({ value: p, label: p })),
  },
  {
    id: "seniority",
    label: "Seniority",
    type: "select",
    options: SENIORITY_LEVELS.map(s => ({ value: s, label: s })),
  },
  {
    id: "isPrimary",
    label: "Primary",
    type: "select",
    options: [
      { value: "yes", label: "Yes" },
      { value: "no", label: "No" },
    ],
  },
];

// Sort options per tab
const DISTRICT_SORT_OPTIONS = [
  { value: "name", label: "Name" },
  { value: "state", label: "State" },
  { value: "renewalTarget", label: "Renewal Target" },
  { value: "winbackTarget", label: "Winback Target" },
  { value: "expansionTarget", label: "Expansion Target" },
  { value: "newBusinessTarget", label: "New Business Target" },
  { value: "enrollment", label: "Enrollment" },
];

const ACTIVITY_SORT_OPTIONS = [
  { value: "startDate", label: "Date" },
  { value: "title", label: "Title" },
  { value: "type", label: "Type" },
  { value: "status", label: "Status" },
];

const CONTACT_SORT_OPTIONS = [
  { value: "name", label: "Name" },
  { value: "title", label: "Title" },
  { value: "persona", label: "Department" },
  { value: "seniority", label: "Seniority" },
];

// Group options per tab
const DISTRICT_GROUP_OPTIONS = [
  { value: "none", label: "No Grouping" },
  { value: "state", label: "By State" },
  { value: "hasTarget", label: "By Target Status" },
];

const ACTIVITY_GROUP_OPTIONS = [
  { value: "none", label: "No Grouping" },
  { value: "status", label: "By Status" },
  { value: "type", label: "By Type" },
];

const CONTACT_GROUP_OPTIONS = [
  { value: "none", label: "No Grouping" },
  { value: "persona", label: "By Department" },
  { value: "seniority", label: "By Seniority" },
  { value: "district", label: "By District" },
];

// localStorage key for saved views
const SAVED_VIEWS_KEY = "territory-plan-saved-views";

export default function PlanTabs({
  planId,
  districts,
  activities,
  contacts,
  onRemoveDistrict,
  isRemovingDistrict,
  onEditActivity,
  onDeleteActivity,
  isDeletingActivity,
  onEditContact,
  onDeleteContact,
  onDistrictClick,
  onContactClick,
}: PlanTabsProps) {
  const [activeTab, setActiveTab] = useState<TabId>("districts");
  const [views, setViews] = useState<Record<TabId, "cards" | "table">>({
    districts: "table",
    activities: "table",
    contacts: "table",
    tasks: "table",
  });

  // Filter state per tab
  const [filters, setFilters] = useState<Record<TabId, Record<string, string | string[]>>>({
    districts: {},
    activities: {},
    contacts: {},
    tasks: {},
  });

  // Search state per tab
  const [searchTerms, setSearchTerms] = useState<Record<TabId, string>>({
    districts: "",
    activities: "",
    contacts: "",
    tasks: "",
  });

  // Sort state per tab
  const [sortConfigs, setSortConfigs] = useState<Record<TabId, { field: string; direction: "asc" | "desc" }>>({
    districts: { field: "name", direction: "asc" },
    activities: { field: "startDate", direction: "desc" },
    contacts: { field: "name", direction: "asc" },
    tasks: { field: "createdAt", direction: "desc" },
  });

  // Group state per tab
  const [groupByConfigs, setGroupByConfigs] = useState<Record<TabId, string>>({
    districts: "none",
    activities: "none",
    contacts: "none",
    tasks: "none",
  });

  // Fetch task count for the tab badge
  const { data: tasksData } = useTasks({ planId });

  // Saved views
  const [savedViews, setSavedViews] = useState<SavedView[]>([]);

  // Load saved views from localStorage
  useEffect(() => {
    const stored = localStorage.getItem(SAVED_VIEWS_KEY);
    if (stored) {
      try {
        setSavedViews(JSON.parse(stored));
      } catch (e) {
        console.error("Failed to parse saved views:", e);
      }
    }
  }, []);

  // Save views to localStorage
  const saveViewsToStorage = useCallback((views: SavedView[]) => {
    localStorage.setItem(SAVED_VIEWS_KEY, JSON.stringify(views));
    setSavedViews(views);
  }, []);

  const tabs: Tab[] = [
    {
      id: "districts",
      label: "Districts",
      count: districts.length,
      icon: (
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
        </svg>
      ),
    },
    {
      id: "activities",
      label: "Activities",
      count: activities.length,
      icon: (
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
        </svg>
      ),
    },
    {
      id: "contacts",
      label: "Contacts",
      count: contacts.length,
      icon: (
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
        </svg>
      ),
    },
    {
      id: "tasks",
      label: "Tasks",
      count: tasksData?.totalCount || 0,
      icon: (
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 7l2 2 4-4M14 7h6M4 17l2 2 4-4M14 17h6" />
        </svg>
      ),
    },
  ];

  // Get dynamic filter options based on data
  const getDistrictFilters = useCallback((): FilterConfig[] => {
    const states = [...new Set(districts.map(d => d.stateAbbrev).filter(Boolean))].sort();
    const services = [...new Set(districts.flatMap(d => [
      ...(d.returnServices?.map(s => s.name) || []),
      ...(d.newServices?.map(s => s.name) || []),
    ]))].sort();

    return DISTRICT_FILTERS.map(f => {
      if (f.id === "state") {
        return { ...f, options: states.map(s => ({ value: s!, label: s! })) };
      }
      if (f.id === "services") {
        return { ...f, options: services.map(s => ({ value: s, label: s })) };
      }
      return f;
    });
  }, [districts]);

  // Apply filters, search, and sort to data
  const getFilteredDistricts = useCallback(() => {
    let result = [...districts];
    const search = searchTerms.districts.toLowerCase();
    const filterState = filters.districts;
    const sort = sortConfigs.districts;

    // Search
    if (search) {
      result = result.filter(d =>
        d.name.toLowerCase().includes(search) ||
        d.leaid.toLowerCase().includes(search) ||
        (d.stateAbbrev?.toLowerCase().includes(search))
      );
    }

    // Filters
    if (filterState.state) {
      result = result.filter(d => d.stateAbbrev === filterState.state);
    }
    if (filterState.hasTarget === "yes") {
      result = result.filter(d => d.renewalTarget || d.winbackTarget || d.expansionTarget || d.newBusinessTarget);
    } else if (filterState.hasTarget === "no") {
      result = result.filter(d => !d.renewalTarget && !d.winbackTarget && !d.expansionTarget && !d.newBusinessTarget);
    }
    if (filterState.services && Array.isArray(filterState.services) && filterState.services.length > 0) {
      result = result.filter(d =>
        d.returnServices?.some(s => (filterState.services as string[]).includes(s.name)) ||
        d.newServices?.some(s => (filterState.services as string[]).includes(s.name))
      );
    }

    // Sort
    result.sort((a, b) => {
      let comparison = 0;
      switch (sort.field) {
        case "name":
          comparison = a.name.localeCompare(b.name);
          break;
        case "state":
          comparison = (a.stateAbbrev || "").localeCompare(b.stateAbbrev || "");
          break;
        case "renewalTarget":
          comparison = (a.renewalTarget || 0) - (b.renewalTarget || 0);
          break;
        case "winbackTarget":
          comparison = (a.winbackTarget || 0) - (b.winbackTarget || 0);
          break;
        case "expansionTarget":
          comparison = (a.expansionTarget || 0) - (b.expansionTarget || 0);
          break;
        case "newBusinessTarget":
          comparison = (a.newBusinessTarget || 0) - (b.newBusinessTarget || 0);
          break;
        case "enrollment":
          comparison = (a.enrollment || 0) - (b.enrollment || 0);
          break;
      }
      return sort.direction === "asc" ? comparison : -comparison;
    });

    return result;
  }, [districts, searchTerms.districts, filters.districts, sortConfigs.districts]);

  const getFilteredActivities = useCallback(() => {
    let result = [...activities];
    const search = searchTerms.activities.toLowerCase();
    const filterState = filters.activities;
    const sort = sortConfigs.activities;

    // Search
    if (search) {
      result = result.filter(a =>
        a.title.toLowerCase().includes(search) ||
        a.type.toLowerCase().includes(search)
      );
    }

    // Filters
    if (filterState.status) {
      result = result.filter(a => a.status === filterState.status);
    }
    if (filterState.type) {
      result = result.filter(a => a.type === filterState.type);
    }

    // Sort
    result.sort((a, b) => {
      let comparison = 0;
      switch (sort.field) {
        case "startDate":
          comparison = (a.startDate ? new Date(a.startDate).getTime() : Infinity) - (b.startDate ? new Date(b.startDate).getTime() : Infinity);
          break;
        case "title":
          comparison = a.title.localeCompare(b.title);
          break;
        case "type":
          comparison = a.type.localeCompare(b.type);
          break;
        case "status":
          comparison = a.status.localeCompare(b.status);
          break;
      }
      return sort.direction === "asc" ? comparison : -comparison;
    });

    return result;
  }, [activities, searchTerms.activities, filters.activities, sortConfigs.activities]);

  const getFilteredContacts = useCallback(() => {
    let result = [...contacts];
    const search = searchTerms.contacts.toLowerCase();
    const filterState = filters.contacts;
    const sort = sortConfigs.contacts;

    // Search
    if (search) {
      result = result.filter(c =>
        c.name.toLowerCase().includes(search) ||
        (c.title?.toLowerCase().includes(search)) ||
        (c.email?.toLowerCase().includes(search))
      );
    }

    // Filters
    if (filterState.persona) {
      result = result.filter(c => c.persona === filterState.persona);
    }
    if (filterState.seniority) {
      result = result.filter(c => c.seniorityLevel === filterState.seniority);
    }
    if (filterState.isPrimary === "yes") {
      result = result.filter(c => c.isPrimary);
    } else if (filterState.isPrimary === "no") {
      result = result.filter(c => !c.isPrimary);
    }

    // Sort
    result.sort((a, b) => {
      let comparison = 0;
      switch (sort.field) {
        case "name":
          comparison = a.name.localeCompare(b.name);
          break;
        case "title":
          comparison = (a.title || "").localeCompare(b.title || "");
          break;
        case "persona":
          comparison = (a.persona || "").localeCompare(b.persona || "");
          break;
        case "seniority":
          comparison = (a.seniorityLevel || "").localeCompare(b.seniorityLevel || "");
          break;
      }
      return sort.direction === "asc" ? comparison : -comparison;
    });

    return result;
  }, [contacts, searchTerms.contacts, filters.contacts, sortConfigs.contacts]);

  // Group data - generic function to group items by a key
  function groupData<T>(
    data: T[],
    groupBy: string,
    getGroupValue: (item: T) => string
  ): Map<string, T[]> {
    if (groupBy === "none") {
      return new Map([["all", data]]);
    }

    const groups = new Map<string, T[]>();
    data.forEach(item => {
      const groupValue = getGroupValue(item) || "Unspecified";
      const existing = groups.get(groupValue) || [];
      existing.push(item);
      groups.set(groupValue, existing);
    });

    return groups;
  }

  // Save view handler
  const handleSaveView = useCallback((name: string) => {
    const newView: SavedView = {
      id: `view-${Date.now()}`,
      name,
      tab: activeTab,
      filters: filters[activeTab],
      sort: sortConfigs[activeTab],
      groupBy: groupByConfigs[activeTab],
      viewMode: views[activeTab],
    };
    saveViewsToStorage([...savedViews, newView]);
  }, [activeTab, filters, sortConfigs, groupByConfigs, views, savedViews, saveViewsToStorage]);

  // Load view handler
  const handleLoadView = useCallback((view: SavedView) => {
    setFilters(prev => ({ ...prev, [view.tab]: view.filters }));
    setSortConfigs(prev => ({ ...prev, [view.tab]: view.sort }));
    setGroupByConfigs(prev => ({ ...prev, [view.tab]: view.groupBy }));
    setViews(prev => ({ ...prev, [view.tab]: view.viewMode }));
  }, []);

  // Delete view handler
  const handleDeleteView = useCallback((viewId: string) => {
    saveViewsToStorage(savedViews.filter(v => v.id !== viewId));
  }, [savedViews, saveViewsToStorage]);

  // Get current tab's filter config
  const getCurrentFilterConfig = () => {
    switch (activeTab) {
      case "districts":
        return {
          filters: getDistrictFilters(),
          sortOptions: DISTRICT_SORT_OPTIONS,
          groupOptions: DISTRICT_GROUP_OPTIONS,
        };
      case "activities":
        return {
          filters: ACTIVITY_FILTERS,
          sortOptions: ACTIVITY_SORT_OPTIONS,
          groupOptions: ACTIVITY_GROUP_OPTIONS,
        };
      case "contacts":
        return {
          filters: CONTACT_FILTERS,
          sortOptions: CONTACT_SORT_OPTIONS,
          groupOptions: CONTACT_GROUP_OPTIONS,
        };
      case "tasks":
        return {
          filters: [],
          sortOptions: [],
          groupOptions: [],
        };
    }
  };

  const config = getCurrentFilterConfig();
  const tabSavedViews = savedViews.filter(v => v.tab === activeTab);

  // Render grouped content
  const renderGroupedContent = () => {
    const view = views[activeTab];
    const groupBy = groupByConfigs[activeTab];

    switch (activeTab) {
      case "districts": {
        const filtered = getFilteredDistricts();
        const grouped = groupData(filtered, groupBy, (d) => {
          if (groupBy === "state") return d.stateAbbrev || "";
          if (groupBy === "hasTarget") return (d.renewalTarget || d.winbackTarget || d.expansionTarget || d.newBusinessTarget) ? "Has Target" : "No Target";
          return "all";
        });

        if (view === "table" && groupBy === "none") {
          return (
            <DistrictsTable
              planId={planId}
              districts={filtered}
              onRemove={onRemoveDistrict}
              isRemoving={isRemovingDistrict}
              onDistrictClick={onDistrictClick}
            />
          );
        }

        return (
          <div className="space-y-6">
            {Array.from(grouped.entries()).map(([group, items]) => (
              <div key={group}>
                {groupBy !== "none" && (
                  <h3 className="text-sm font-semibold text-[#403770] mb-3 flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full bg-[#F37167]" />
                    {group}
                    <span className="text-gray-400 font-normal">({items.length})</span>
                  </h3>
                )}
                {view === "table" ? (
                  <DistrictsTable
                    planId={planId}
                    districts={items}
                    onRemove={onRemoveDistrict}
                    isRemoving={isRemovingDistrict}
                    onDistrictClick={onDistrictClick}
                  />
                ) : (
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                    {items.map((district) => (
                      <DistrictCard
                        key={district.leaid}
                        district={district}
                        onRemove={() => onRemoveDistrict(district.leaid)}
                        onClick={onDistrictClick ? () => onDistrictClick(district.leaid) : undefined}
                      />
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>
        );
      }

      case "activities": {
        const filtered = getFilteredActivities();
        const grouped = groupData(filtered, groupBy, (a) => {
          if (groupBy === "status") return a.status;
          if (groupBy === "type") return a.type;
          return "all";
        });

        if (view === "table" && groupBy === "none") {
          return (
            <ActivitiesTable
              activities={filtered}
              onEdit={onEditActivity}
              onDelete={onDeleteActivity}
              isDeleting={isDeletingActivity}
            />
          );
        }

        return (
          <div className="space-y-6">
            {Array.from(grouped.entries()).map(([group, items]) => (
              <div key={group}>
                {groupBy !== "none" && (
                  <h3 className="text-sm font-semibold text-[#403770] mb-3 flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full bg-[#6EA3BE]" />
                    {group.replace(/_/g, " ").replace(/\b\w/g, c => c.toUpperCase())}
                    <span className="text-gray-400 font-normal">({items.length})</span>
                  </h3>
                )}
                {view === "table" ? (
                  <ActivitiesTable
                    activities={items}
                    onEdit={onEditActivity}
                    onDelete={onDeleteActivity}
                    isDeleting={isDeletingActivity}
                  />
                ) : (
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                    {items.map((activity) => (
                      <ActivityCard
                        key={activity.id}
                        activity={activity}
                        onEdit={() => onEditActivity(activity)}
                        onDelete={() => onDeleteActivity(activity.id)}
                      />
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>
        );
      }

      case "contacts": {
        const filtered = getFilteredContacts();
        // Create district name lookup for grouping by district
        const districtNameMap = new Map(districts.map(d => [d.leaid, d.name]));
        const grouped = groupData(filtered, groupBy, (c) => {
          if (groupBy === "persona") return c.persona || "";
          if (groupBy === "seniority") return c.seniorityLevel || "";
          if (groupBy === "district") return districtNameMap.get(c.leaid) || c.leaid;
          return "all";
        });

        if (view === "table" && groupBy === "none") {
          return (
            <ContactsTable
              contacts={filtered}
              districtNameMap={districtNameMap}
              totalCount={contacts.length}
              onEdit={onEditContact}
              onDelete={onDeleteContact}
              onContactClick={onContactClick}
            />
          );
        }

        return (
          <div className="space-y-6">
            {Array.from(grouped.entries()).map(([group, items]) => (
              <div key={group}>
                {groupBy !== "none" && (
                  <h3 className="text-sm font-semibold text-[#403770] mb-3 flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full bg-[#C4E7E6]" />
                    {group || "Unspecified"}
                    <span className="text-gray-400 font-normal">({items.length})</span>
                  </h3>
                )}
                {view === "table" ? (
                  <ContactsTable
                    contacts={items}
                    districtNameMap={districtNameMap}
                    totalCount={contacts.length}
                    onEdit={onEditContact}
                    onDelete={onDeleteContact}
                    onContactClick={onContactClick}
                  />
                ) : (
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                    {items.map((contact) => (
                      <ContactCard
                        key={contact.id}
                        contact={contact}
                        districtName={districtNameMap.get(contact.leaid)}
                        onEdit={onEditContact ? () => onEditContact(contact) : undefined}
                        onDelete={onDeleteContact ? () => onDeleteContact(contact.id) : undefined}
                        onClick={onContactClick ? () => onContactClick(contact.leaid, contact.id) : undefined}
                      />
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>
        );
      }

      case "tasks": {
        // Tasks tab uses the reusable TaskList component — filtered by planId
        return (
          <div className="py-2">
            <TaskList planId={planId} />
          </div>
        );
      }
    }
  };

  return (
    <div className="space-y-4">
      {/* Tab Navigation */}
      <div className="flex items-center justify-between border-b border-gray-200">
        <nav className="flex -mb-px" aria-label="Tabs">
          {tabs.map((tab) => {
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`
                  group relative flex items-center gap-2 px-6 py-3 text-sm font-medium transition-colors
                  ${isActive
                    ? "text-[#403770]"
                    : "text-gray-500 hover:text-[#403770]"
                  }
                `}
                aria-current={isActive ? "page" : undefined}
              >
                <span className={`${isActive ? "text-[#F37167]" : "text-gray-400 group-hover:text-[#6EA3BE]"} transition-colors`}>
                  {tab.icon}
                </span>
                <span>{tab.label}</span>
                <span className={`
                  ml-1 px-2 py-0.5 text-xs font-semibold rounded-full
                  ${isActive
                    ? "bg-[#403770] text-white"
                    : "bg-gray-100 text-gray-500"
                  }
                `}>
                  {tab.count}
                </span>

                {/* Active tab indicator - solid line accent */}
                {isActive && (
                  <span
                    className="absolute bottom-0 left-0 right-0 h-0.5 bg-[#F37167]"
                  />
                )}
              </button>
            );
          })}
        </nav>

        {/* View Toggle — hidden on Tasks tab which has its own UI */}
        {activeTab !== "tasks" && (
          <div className="pb-3">
            <ViewToggle
              view={views[activeTab]}
              onViewChange={(view) => setViews(prev => ({ ...prev, [activeTab]: view as "cards" | "table" }))}
            />
          </div>
        )}
      </div>

      {/* Filter Bar — hidden on Tasks tab which uses its own UI */}
      {activeTab !== "tasks" && (
        <FilterBar
          filters={config.filters}
          activeFilters={filters[activeTab]}
          onFilterChange={(newFilters) => setFilters(prev => ({ ...prev, [activeTab]: newFilters }))}
          searchTerm={searchTerms[activeTab]}
          onSearchChange={(term) => setSearchTerms(prev => ({ ...prev, [activeTab]: term }))}
          sortOptions={config.sortOptions}
          currentSort={sortConfigs[activeTab]}
          onSortChange={(sort) => setSortConfigs(prev => ({ ...prev, [activeTab]: sort }))}
          groupOptions={config.groupOptions}
          currentGroup={groupByConfigs[activeTab]}
          onGroupChange={(group) => setGroupByConfigs(prev => ({ ...prev, [activeTab]: group }))}
          savedViews={tabSavedViews}
          onSaveView={handleSaveView}
          onLoadView={handleLoadView}
          onDeleteView={handleDeleteView}
        />
      )}

      {/* Tab Content */}
      <div className="min-h-[200px]">
        {renderGroupedContent()}
      </div>
    </div>
  );
}
