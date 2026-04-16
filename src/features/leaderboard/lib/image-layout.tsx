import type { LeaderboardPayload } from "./fetch-leaderboard";
import { formatCurrencyShort } from "./format";

const PLUM = "#403770";
const PLUM_DARK = "#322a5a";
const SURFACE = "#FFFCFA";
const SURFACE_RAISED = "#F7F5FA";
const HOVER_TINT = "#EFEDF5";
const BORDER_SUBTLE = "#E2DEEC";
const TEXT_BODY = "#6E6390";
const TEXT_STRONG = "#544A78";
const INVERSE = "#FFFFFF";

const ROW_HEIGHT = 44;
const COL_RANK_W = 60;
const COL_REP_W = 320;
const COL_NUM_W = 175;

function formatHeaderDate(d: Date): string {
  return d.toLocaleDateString("en-US", {
    weekday: "long", month: "long", day: "numeric", year: "numeric",
    timeZone: "America/Chicago",
  });
}

interface LeaderboardImageLayoutProps {
  payload: LeaderboardPayload;
  /** Used for the date stamp in the header; defaults to now. */
  renderedAt?: Date;
}

export function LeaderboardImageLayout({ payload, renderedAt }: LeaderboardImageLayoutProps) {
  const date = renderedAt ?? new Date();
  const { entries, teamTotals, initiative, fiscalYears } = payload;

  // Pretty FY labels: "2025-26" → "FY26", "2026-27" → "FY27"
  const fyLabel = (s: string) => `FY${s.split("-")[1]}`;
  const currentFYLabel = fyLabel(fiscalYears.currentFY);
  const nextFYLabel = fyLabel(fiscalYears.nextFY);

  return (
    <div
      style={{
        display: "flex", flexDirection: "column",
        width: 1200, backgroundColor: SURFACE,
        fontFamily: "Plus Jakarta Sans",
        color: TEXT_BODY,
      }}
    >
      {/* Header band */}
      <div
        style={{
          display: "flex", flexDirection: "column",
          backgroundColor: PLUM, color: INVERSE,
          padding: "32px 40px",
        }}
      >
        <div style={{ display: "flex", flexDirection: "row", justifyContent: "space-between", alignItems: "flex-end" }}>
          <div style={{ display: "flex", flexDirection: "column" }}>
            <div style={{ fontSize: 32, fontWeight: 600, color: INVERSE }}>
              Fullmind Sales Leaderboard
            </div>
            <div style={{ fontSize: 16, marginTop: 6, color: "#D8D2EC" }}>
              {formatHeaderDate(date)}
            </div>
          </div>
          <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end" }}>
            <div style={{ fontSize: 14, color: "#D8D2EC" }}>{initiative.name}</div>
            <div style={{ fontSize: 14, color: "#D8D2EC", marginTop: 4 }}>
              {`Revenue & Min Purchases · ${currentFYLabel}  ·  Pipeline & Targets · ${nextFYLabel}`}
            </div>
          </div>
        </div>
      </div>

      {/* Column headers */}
      <div
        style={{
          display: "flex", flexDirection: "row",
          backgroundColor: SURFACE_RAISED,
          color: TEXT_STRONG,
          fontSize: 13, fontWeight: 600,
          padding: "0 40px",
          borderBottom: `1px solid ${BORDER_SUBTLE}`,
        }}
      >
        <div style={{ display: "flex", width: COL_RANK_W, padding: "14px 0" }}>#</div>
        <div style={{ display: "flex", width: COL_REP_W, padding: "14px 0" }}>Rep</div>
        <div style={{ display: "flex", width: COL_NUM_W, padding: "14px 0", justifyContent: "flex-end" }}>{`Revenue (${currentFYLabel})`}</div>
        <div style={{ display: "flex", width: COL_NUM_W, padding: "14px 0", justifyContent: "flex-end" }}>{`Min Purchases (${currentFYLabel})`}</div>
        <div style={{ display: "flex", width: COL_NUM_W, padding: "14px 0", justifyContent: "flex-end" }}>{`Pipeline (${nextFYLabel})`}</div>
        <div style={{ display: "flex", width: COL_NUM_W, padding: "14px 0", justifyContent: "flex-end" }}>{`Targeted (${nextFYLabel})`}</div>
      </div>

      {/* Rep rows */}
      <div style={{ display: "flex", flexDirection: "column" }}>
        {entries.map((e, i) => (
          <div
            key={e.userId}
            style={{
              display: "flex", flexDirection: "row",
              backgroundColor: i % 2 === 0 ? SURFACE : SURFACE_RAISED,
              color: TEXT_BODY,
              fontSize: 14, fontWeight: 400,
              padding: "0 40px",
              height: ROW_HEIGHT, alignItems: "center",
            }}
          >
            <div style={{ display: "flex", width: COL_RANK_W, color: TEXT_STRONG, fontWeight: 600 }}>{String(e.rank)}</div>
            <div style={{ display: "flex", width: COL_REP_W, color: TEXT_STRONG }}>{e.fullName}</div>
            <div style={{ display: "flex", width: COL_NUM_W, justifyContent: "flex-end" }}>{formatCurrencyShort(e.revenueCurrentFY)}</div>
            <div style={{ display: "flex", width: COL_NUM_W, justifyContent: "flex-end" }}>{formatCurrencyShort(e.minPurchasesCurrentFY)}</div>
            <div style={{ display: "flex", width: COL_NUM_W, justifyContent: "flex-end" }}>{formatCurrencyShort(e.pipelineNextFY)}</div>
            <div style={{ display: "flex", width: COL_NUM_W, justifyContent: "flex-end" }}>{formatCurrencyShort(e.targetedNextFY)}</div>
          </div>
        ))}
      </div>

      {/* Team totals footer */}
      <div
        style={{
          display: "flex", flexDirection: "row",
          backgroundColor: HOVER_TINT,
          color: PLUM_DARK,
          fontSize: 14, fontWeight: 600,
          padding: "0 40px",
          height: ROW_HEIGHT + 6, alignItems: "center",
          borderTop: `1px solid ${BORDER_SUBTLE}`,
        }}
      >
        <div style={{ display: "flex", width: COL_RANK_W }} />
        <div style={{ display: "flex", width: COL_REP_W }}>Team Total</div>
        <div style={{ display: "flex", width: COL_NUM_W, justifyContent: "flex-end" }}>{formatCurrencyShort(teamTotals.revenueCurrentFY)}</div>
        <div style={{ display: "flex", width: COL_NUM_W, justifyContent: "flex-end" }}>{formatCurrencyShort(teamTotals.minPurchasesCurrentFY)}</div>
        <div style={{ display: "flex", width: COL_NUM_W, justifyContent: "flex-end" }}>{formatCurrencyShort(teamTotals.pipelineNextFY)}</div>
        <div style={{ display: "flex", width: COL_NUM_W, justifyContent: "flex-end" }}>{formatCurrencyShort(teamTotals.targetedNextFY)}</div>
      </div>
    </div>
  );
}
