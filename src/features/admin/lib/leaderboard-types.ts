// src/features/admin/lib/leaderboard-types.ts

export interface AdminSeasonConfig {
  season: {
    id: number;
    name: string;
    seasonUid: string | null;
    startDate: string;
    endDate: string | null;
    isActive: boolean;
    showName: boolean;
    showDates: boolean;
    softResetTiers: number;
    seasonWeight: number;
    pipelineWeight: number;
    takeWeight: number;
  };
  metrics: AdminMetric[];
  thresholds: AdminThreshold[];
  repCounts: Record<string, number>;
}

export interface AdminMetric {
  id: number;
  action: string;
  label: string;
  pointValue: number;
  weight: number;
}

export interface AdminThreshold {
  id: number;
  tier: string;
  minPoints: number;
}

export interface RegistryEntry {
  id: number;
  action: string;
  label: string;
  description: string;
  category: string;
}

export interface PreviewResult {
  changes: { field: string; before: string; after: string }[];
  repImpact: {
    count: number;
    reps: { userId: string; fullName: string; beforeTier: string; afterTier: string }[];
  } | null;
}

export interface SeasonIdentityPayload {
  name: string;
  startDate: string;
  endDate: string | null;
  showName: boolean;
  showDates: boolean;
}

export interface MetricsPayload {
  metrics: { action: string; label: string; pointValue: number; weight: number }[];
}

export interface TiersPayload {
  thresholds: { tier: string; minPoints: number }[];
}

export interface WeightsPayload {
  seasonWeight: number;
  pipelineWeight: number;
  takeWeight: number;
}

export interface TransitionPayload {
  softResetTiers: number;
}

export interface PreviewPayload {
  section: "season" | "metrics" | "tiers" | "weights" | "transition";
  data: SeasonIdentityPayload | MetricsPayload | TiersPayload | WeightsPayload | TransitionPayload;
}
