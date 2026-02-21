"use client";

import { useEffect } from "react";
import { useMapStore } from "@/features/shared/lib/app-store";

interface ClickRippleProps {
  containerRef: React.RefObject<HTMLDivElement | null>;
}

export default function ClickRipple({ containerRef }: ClickRippleProps) {
  const { clickRipples, removeClickRipple } = useMapStore();

  return (
    <>
      {clickRipples.map((ripple) => (
        <RippleElement
          key={ripple.id}
          id={ripple.id}
          x={ripple.x}
          y={ripple.y}
          color={ripple.color}
          containerRef={containerRef}
          onComplete={removeClickRipple}
        />
      ))}
    </>
  );
}

interface RippleElementProps {
  id: number;
  x: number;
  y: number;
  color: "coral" | "plum";
  containerRef: React.RefObject<HTMLDivElement | null>;
  onComplete: (id: number) => void;
}

function RippleElement({
  id,
  x,
  y,
  color,
  containerRef,
  onComplete,
}: RippleElementProps) {
  // Remove ripple after animation completes
  useEffect(() => {
    const timer = setTimeout(() => {
      onComplete(id);
    }, 400); // Match animation duration

    return () => clearTimeout(timer);
  }, [id, onComplete]);

  // Calculate position relative to container
  const containerRect = containerRef.current?.getBoundingClientRect();
  if (!containerRect) return null;

  const left = x - containerRect.left;
  const top = y - containerRect.top;

  return (
    <div
      className={`click-ripple click-ripple-${color}`}
      style={{
        left,
        top,
      }}
      aria-hidden="true"
    />
  );
}
