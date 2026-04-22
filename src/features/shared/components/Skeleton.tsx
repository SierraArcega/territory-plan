import { cn } from "@/features/shared/lib/cn";

export type SkeletonVariant = "text" | "card" | "thumbnail";

interface SkeletonProps {
  variant?: SkeletonVariant;
  className?: string;
}

const VARIANT_CLASSES: Record<SkeletonVariant, string> = {
  text: "h-4 w-full rounded",
  card: "h-24 w-full rounded-xl",
  thumbnail: "h-12 w-12 rounded-lg",
};

export function Skeleton({ variant = "text", className }: SkeletonProps) {
  return (
    <div
      role="status"
      aria-label="Loading"
      className={cn(
        "animate-pulse bg-[#EFEDF5]",
        VARIANT_CLASSES[variant],
        className
      )}
    />
  );
}
