// "Last 7 days" week-over-week delta for the topline cards. Derived from
// opportunity_snapshots (daily, ~6 weeks deep) which only carry stage +
// net_booking_amount — so WoW is available for Open Pipeline and Bookings only
// (Revenue/Take/Targets have no snapshot source). Pure; the route fetches the
// two snapshot rows (latest + ~7 days prior).

export interface WowSnapshotRow {
  date: string;
  openPipeline: number;
  bookings: number;
}

export interface WowDeltas {
  openPipeline: number | null;
  bookings: number | null;
}

export function buildWowDeltas(rows: WowSnapshotRow[]): WowDeltas {
  if (rows.length < 2) return { openPipeline: null, bookings: null };
  const sorted = [...rows].sort((a, b) => (a.date < b.date ? 1 : -1)); // newest first
  const latest = sorted[0];
  const prior = sorted[1];
  const delta = (now: number, was: number) => (was > 0 ? (now - was) / was : null);
  return {
    openPipeline: delta(latest.openPipeline, prior.openPipeline),
    bookings: delta(latest.bookings, prior.bookings),
  };
}
