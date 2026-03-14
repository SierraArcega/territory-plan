"use client";

import { useState } from "react";
import Sidebar from "@/features/shared/components/navigation/Sidebar";

interface AdminShellProps {
  children: React.ReactNode;
}

export default function AdminShell({ children }: AdminShellProps) {
  const [collapsed, setCollapsed] = useState(false);

  return (
    <div className="fixed inset-0 flex bg-[#FFFCFA] overflow-hidden">
      {/* Sidebar — same as main app, with admin section visible */}
      <Sidebar
        activeTab="home"
        onTabChange={(tab) => {
          // Navigate to main app tabs
          window.location.href = tab === "home" ? "/" : `/?tab=${tab}`;
        }}
        collapsed={collapsed}
        onCollapsedChange={setCollapsed}
        isAdmin={true}
      />

      {/* Content area */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Admin header */}
        <header className="border-b border-[#D4CFE2] bg-white px-6 py-4 flex-shrink-0">
          <div className="flex items-center gap-3">
            <a href="/" className="text-sm font-medium text-[#8A80A8] hover:text-[#403770] transition-colors">
              &larr; Territory Planner
            </a>
            <span className="text-[#D4CFE2]">/</span>
            <span className="text-sm font-semibold text-[#403770]">Admin</span>
          </div>
        </header>

        {/* Scrollable content */}
        <main className="flex-1 overflow-y-auto">
          <div className="max-w-7xl mx-auto px-6 py-8">
            {children}
          </div>
        </main>
      </div>
    </div>
  );
}
