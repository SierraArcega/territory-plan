import type { CopilotPageContext } from "./types";

const MAX_ROWS = 20;
const MAX_LEAIDS = 50;

/**
 * Render the page context as a compact <current_view> block. Returns null when
 * there's nothing useful to send. Rows are capped to bound token usage.
 */
export function formatPageContextBlock(
  ctx: CopilotPageContext | undefined,
): string | null {
  if (!ctx) return null;
  const lines: string[] = [];
  if (ctx.tab) lines.push(`Active tab: ${ctx.tab}`);
  if (ctx.route) lines.push(`Route: ${ctx.route}`);
  if (ctx.openDistrict) {
    lines.push(
      `Open district: ${ctx.openDistrict.name ?? "(unnamed)"} (leaid ${ctx.openDistrict.leaid})`,
    );
  }
  if (ctx.openPlanId != null) lines.push(`Open plan id: ${ctx.openPlanId}`);
  if (ctx.openEntity) {
    lines.push(
      `Open ${ctx.openEntity.type}: ${ctx.openEntity.label ?? ""} (id ${ctx.openEntity.id})`,
    );
  }
  if (ctx.selectedLeaids?.length) {
    const shown = ctx.selectedLeaids.slice(0, MAX_LEAIDS);
    const capped = ctx.selectedLeaids.length > MAX_LEAIDS ? ", capped" : "";
    lines.push(
      `Selected districts (${ctx.selectedLeaids.length}${capped}): ${shown.join(", ")}`,
    );
  }
  if (ctx.activeFilters?.length) {
    lines.push(`Active filters: ${ctx.activeFilters.join("; ")}`);
  }
  if (ctx.visibleRows?.length) {
    const rows = ctx.visibleRows.slice(0, MAX_ROWS);
    const suffix =
      ctx.visibleRows.length > MAX_ROWS
        ? ` of ${ctx.visibleRows.length}, capped`
        : "";
    const label = ctx.visibleRowsLabel ? `${ctx.visibleRowsLabel} — ` : "";
    lines.push(`Visible rows — ${label}showing ${rows.length}${suffix}:`);
    lines.push(JSON.stringify(rows));
  }
  if (lines.length === 0) return null;
  return `<current_view>\n${lines.join("\n")}\n</current_view>`;
}

/** Prepend the <current_view> block to the user message (never the cached
 *  system prompt — page context changes every turn). */
export function withPageContext(
  message: string,
  ctx: CopilotPageContext | undefined,
): string {
  const block = formatPageContextBlock(ctx);
  return block ? `${block}\n\n${message}` : message;
}
