"use client";

import {
  Home,
  Map,
  ClipboardList,
  Calendar,
  ListChecks,
  BarChart2,
  Trophy,
  Apple,
  BookOpen,
  User,
  UserCheck,
  Settings,
} from "lucide-react";
import type { TabId } from "./Sidebar";

interface NavItem {
  id: TabId;
  label: string;
  icon: React.ReactNode;
}

const MAIN_ITEMS: NavItem[] = [
  { id: "home",             label: "Home",      icon: <Home className="w-5 h-5" /> },
  { id: "map",              label: "Map",        icon: <Map className="w-5 h-5" /> },
  { id: "plans",            label: "Plans",      icon: <ClipboardList className="w-5 h-5" /> },
  { id: "leads",            label: "Leads",      icon: <UserCheck className="w-5 h-5" /> },
  { id: "activities",       label: "Activities", icon: <Calendar className="w-5 h-5" /> },
  { id: "tasks",            label: "Tasks",      icon: <ListChecks className="w-5 h-5" /> },
  { id: "reports",          label: "Reports",    icon: <BarChart2 className="w-5 h-5" /> },
  { id: "leaderboard",      label: "Rankings",   icon: <Trophy className="w-5 h-5" /> },
  { id: "low-hanging-fruit",label: "LHF",        icon: <Apple className="w-5 h-5" /> },
  { id: "resources",        label: "Resources",  icon: <BookOpen className="w-5 h-5" /> },
];

const ADMIN_ITEM: NavItem = {
  id: "admin",
  label: "Admin",
  icon: <Settings className="w-5 h-5" />,
};

const PROFILE_ITEM: NavItem = {
  id: "profile",
  label: "Profile",
  icon: <User className="w-5 h-5" />,
};

interface BottomNavProps {
  activeTab: TabId;
  onTabChange: (tab: TabId, adminSection?: string) => void;
  isAdmin?: boolean;
}

export default function BottomNav({ activeTab, onTabChange, isAdmin = false }: BottomNavProps) {
  const items: NavItem[] = [
    ...MAIN_ITEMS,
    ...(isAdmin ? [ADMIN_ITEM] : []),
    PROFILE_ITEM,
  ];

  return (
    <nav
      className="flex flex-row border-t border-[#D4CFE2] bg-white overflow-x-auto"
      style={{ paddingBottom: "env(safe-area-inset-bottom)", touchAction: "pan-x" }}
    >
      {items.map((item) => {
        const isActive = activeTab === item.id;
        return (
          <button
            key={item.id}
            onClick={() => onTabChange(item.id)}
            className={`
              flex flex-col items-center justify-center gap-1 px-3 py-2 min-w-[56px] flex-shrink-0
              transition-colors duration-150
              ${isActive ? "text-[#F37167]" : "text-[#403770]"}
            `}
          >
            <span className="flex-shrink-0">{item.icon}</span>
            <span className="text-[10px] font-medium whitespace-nowrap">{item.label}</span>
            {isActive && (
              <span className="absolute bottom-0 left-1/2 -translate-x-1/2 w-1 h-1 rounded-full bg-[#F37167]" />
            )}
          </button>
        );
      })}
    </nav>
  );
}
