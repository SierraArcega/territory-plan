"use client";

interface CampaignStatsPanelProps {
  sequenceId: string;
  activityId: string;
}

export default function CampaignStatsPanel({
  sequenceId,
  activityId,
}: CampaignStatsPanelProps) {
  return (
    <div className="text-center py-12 text-gray-500">
      <p>Campaign stats for sequence {sequenceId} coming soon.</p>
    </div>
  );
}
