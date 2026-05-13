/**
 * /views — the All-Plans portfolio.
 *
 * Mounts the real `PortfolioView` (card grid + Active/Archived tabs +
 * client-side computed header aggregates). The header stats deviate from
 * the README's "Total target / Booked / To target" set — those would
 * require new backend fields. See PortfolioView's file header comment for
 * the full rationale.
 */
import PortfolioView from "@/features/views/components/PortfolioView";

export default function ViewsPortfolioPage() {
  return <PortfolioView />;
}
