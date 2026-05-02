"use client";

interface Props {
  n: number;
  selected?: boolean;
  evicted?: boolean;
  onClick?: () => void;
  /** When true, the pill renders as a gutter marker with the cream halo so it
   *  reads cleanly above the dashed connector line. */
  gutter?: boolean;
  className?: string;
  title?: string;
}

export function VersionPill({
  n,
  selected = false,
  evicted = false,
  onClick,
  gutter = true,
  className = "",
  title,
}: Props) {
  const interactive = !!onClick;
  const Tag = interactive ? "button" : "span";
  const borderColor = selected ? "#F37167" : evicted ? "#D4CFE2" : "#403770";
  const background = selected ? "#F37167" : "#fff";
  const color = selected ? "#fff" : evicted ? "#A69DC0" : "#403770";
  const halo = selected
    ? "0 0 0 3px rgba(243,113,103,0.18), 0 0 0 7px #FFFCFA"
    : gutter
      ? "0 0 0 3px #FFFCFA"
      : "none";

  return (
    <Tag
      type={interactive ? "button" : undefined}
      onClick={onClick}
      title={title}
      className={`inline-flex items-center justify-center whitespace-nowrap rounded-full text-[10.5px] font-bold leading-none tabular-nums transition-all duration-150 ${
        interactive ? "cursor-pointer" : ""
      } ${className}`}
      style={{
        minWidth: 30,
        height: 20,
        padding: "0 7px",
        border: `1.5px solid ${borderColor}`,
        background,
        color,
        boxShadow: halo,
        opacity: evicted ? 0.85 : 1,
        boxSizing: "border-box",
        fontFamily: "inherit",
      }}
    >
      v{n}
    </Tag>
  );
}
