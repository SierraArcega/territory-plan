"use client";

import { useState } from "react";
import { ChevronDown } from "lucide-react";

interface CollapsibleSectionProps {
  title: string;
  subtitle?: string;
  defaultOpen?: boolean;
  children: React.ReactNode;
}

export default function CollapsibleSection({
  title,
  subtitle,
  defaultOpen = false,
  children,
}: CollapsibleSectionProps) {
  const [open, setOpen] = useState(defaultOpen);

  return (
    <div className="border border-[#D4CFE2] rounded-xl bg-white overflow-hidden">
      <button
        onClick={() => setOpen(!open)}
        className="w-full flex items-center justify-between px-6 py-4 text-left hover:bg-[#F7F5FA] transition-colors"
      >
        <div>
          <h3 className="text-base font-semibold text-[#403770]">{title}</h3>
          {subtitle && <p className="text-sm text-[#8A80A8] mt-0.5">{subtitle}</p>}
        </div>
        <ChevronDown
          className={`w-5 h-5 text-[#8A80A8] transition-transform ${open ? "rotate-180" : ""}`}
        />
      </button>
      {open && <div className="px-6 pb-6 pt-2 border-t border-[#E2DEEC]">{children}</div>}
    </div>
  );
}
