"use client";

import { useEffect, useState } from "react";

interface AnimatedCardProps {
  children: React.ReactNode;
  /** Delay before animation starts, in ms */
  delay?: number;
  /** Direction the card slides in from */
  from?: "left" | "right" | "bottom";
  className?: string;
}

export default function AnimatedCard({
  children,
  delay = 0,
  from = "right",
  className = "",
}: AnimatedCardProps) {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const timeout = setTimeout(() => setVisible(true), delay);
    return () => clearTimeout(timeout);
  }, [delay]);

  const translate = {
    left: visible ? "translate-x-0" : "-translate-x-5",
    right: visible ? "translate-x-0" : "translate-x-5",
    bottom: visible ? "translate-y-0" : "translate-y-5",
  }[from];

  return (
    <div
      className={`
        transition-all duration-[600ms] ease-[cubic-bezier(0.16,1,0.3,1)]
        ${visible ? "opacity-100" : "opacity-0"}
        ${translate}
        ${className}
      `}
    >
      {children}
    </div>
  );
}
