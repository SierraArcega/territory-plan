"use client";

/**
 * Single line of a Style B (Terminal) live trace, e.g.
 *   `$ search_metadata("stuck") ✓ 124ms`
 *
 * Three visual states:
 *   - `done`   — full opacity, dimmed body color, trailing green check + ms
 *   - `active` — plum body, pale-plum surface bg, coral left-border, blinking cursor
 *   - `queued` — dimmed lavender, no decoration
 *
 * Mono font + raw underscores in tool names. The arg is a compact string
 * (typically the first scalar argument); when no friendly arg is available
 * the caller passes `"…"` which renders as `tool(…)` per the brief.
 */
export type TraceLineState = "done" | "active" | "queued";

interface Props {
  tool: string;
  arg: string;
  state: TraceLineState;
  /** Elapsed ms — only rendered in the `done` state. */
  ms?: number;
}

export function TraceLine({ tool, arg, state, ms }: Props) {
  const dim = state === "queued";
  const active = state === "active";
  const done = state === "done";

  return (
    <div
      style={{
        fontFamily: "ui-monospace, Menlo, monospace",
        fontSize: 11.5,
        lineHeight: 1.5,
        color: dim ? "#C2BBD4" : active ? "#403770" : "#8A80A8",
        padding: "3px 8px",
        background: active ? "#F7F5FA" : "transparent",
        borderLeft: `2px solid ${active ? "#F37167" : "transparent"}`,
        marginLeft: 2,
        whiteSpace: "nowrap",
        overflow: "hidden",
        textOverflow: "ellipsis",
      }}
    >
      <span style={{ color: "#A69DC0" }}>$</span>{" "}
      <span>
        {tool}({arg})
      </span>
      {active && (
        <span
          style={{
            marginLeft: 4,
            display: "inline-block",
            animation: "fm-blink 1.05s steps(2) infinite",
          }}
        >
          ▌
        </span>
      )}
      {done && ms != null && (
        <span style={{ marginLeft: 8, color: "#8AC670", fontVariantNumeric: "tabular-nums" }}>
          ✓ {ms}ms
        </span>
      )}
    </div>
  );
}
