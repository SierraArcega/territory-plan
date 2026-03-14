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
        {/* Top bar — matches main app FilterBar */}
        <div className="flex-shrink-0 bg-white border-b border-gray-200/60 px-4 py-2">
          <div className="flex items-center gap-3">
            <span className="flex-shrink-0 text-plum font-bold text-base">
              Fullmind
            </span>
          </div>
        </div>

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
