"use client";

import type { ReactNode } from "react";

export interface FieldLabelProps {
  children: ReactNode;
  optional?: boolean;
  hint?: ReactNode;
  htmlFor?: string;
}

export default function FieldLabel({ children, optional, hint, htmlFor }: FieldLabelProps) {
  return (
    <div className="flex items-baseline justify-between mb-1.5">
      <label
        htmlFor={htmlFor}
        className="text-[10px] font-bold tracking-[0.08em] uppercase text-[#8A80A8] whitespace-nowrap"
      >
        {children}
        {optional && (
          <span className="ml-1.5 font-medium text-[#A69DC0] normal-case tracking-normal">
            optional
          </span>
        )}
      </label>
      {hint && <span className="text-[10px] text-[#A69DC0]">{hint}</span>}
    </div>
  );
}
