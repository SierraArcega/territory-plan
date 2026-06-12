// Tiny section label — 10px uppercase with wide tracking. Per LeadBits.jsx.

import type { CSSProperties, ReactNode } from "react";

export default function MicroLabel({
  children,
  className,
  style,
}: {
  children: ReactNode;
  className?: string;
  style?: CSSProperties;
}) {
  return (
    <div
      className={`text-[10px] font-bold uppercase tracking-[0.09em] text-[#8A80A8] ${className ?? ""}`}
      style={style}
    >
      {children}
    </div>
  );
}
