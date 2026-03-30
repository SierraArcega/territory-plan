// src/features/admin/lib/leaderboard-types.ts

export interface AdminInitiativeConfig {
  initiative: {
    id: number;
    name: string;
    initiativeUid: string | null;
    startDate: string;
    endDate: string | null;
    isActive: boolean;
    showName: boolean;
    showDates: boolean;
    softResetTiers: number;
    initiativeWeight: number;
    pipelineWeight: number;
    takeWeight: number;
    revenueWeight: number;
    pipelineFiscalYear: string | null;
    takeFiscalYear: string | null;
    revenueFiscalYear: string | null;
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

export interface InitiativeIdentityPayload {
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
  initiativeWeight: number;
  pipelineWeight: number;
  takeWeight: number;
  revenueWeight: number;
  pipelineFiscalYear: string | null;
  takeFiscalYear: string | null;
  revenueFiscalYear: string | null;
}

export interface PreviewPayload {
  section: "initiative" | "metrics" | "tiers" | "weights";
  data: InitiativeIdentityPayload | MetricsPayload | TiersPayload | WeightsPayload;
}
