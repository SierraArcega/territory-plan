// Team Progress feature types

export interface CategoryMetric {
  target: number;
  actual: number;
}

export interface OpportunityItem {
  id: string;
  name: string;
  stage: string;
  contractType: string | null;
  netBookingAmount: number;
  totalRevenue: number;
  totalTake: number;
}

export interface DistrictProgress {
  leaid: string;
  name: string;
  stateAbbrev: string | null;
  category: string;
  renewalActual: number;
  expansionActual: number;
  winbackActual: number;
  newBusinessActual: number;
  renewalTarget: number;
  expansionTarget: number;
  winbackTarget: number;
  newBusinessTarget: number;
  currentRevenue: number;
  currentTake: number;
  priorRevenue: number;
  opportunities: OpportunityItem[];
}

export interface PlanProgress {
  id: string;
  name: string;
  color: string;
  owner: { id: string; fullName: string; avatarUrl: string | null } | null;
  districtCount: number;
  renewal: CategoryMetric;
  expansion: CategoryMetric;
  winback: CategoryMetric;
  newBusiness: CategoryMetric;
  total: CategoryMetric;
  totalTake: number;
  districts: DistrictProgress[];
}

export interface UnmappedDistrict {
  leaid: string;
  name: string;
  stateAbbrev: string | null;
  currentRevenue: number;
  currentTake: number;
  opportunities: OpportunityItem[];
}

export interface TeamProgressResponse {
  fiscalYear: number;
  totals: {
    renewal: CategoryMetric;
    expansion: CategoryMetric;
    winback: CategoryMetric;
    newBusiness: CategoryMetric;
    combined: CategoryMetric;
    totalTake: number;
  };
  plans: PlanProgress[];
  unmapped: {
    totalRevenue: number;
    totalTake: number;
    districtCount: number;
    districts: UnmappedDistrict[];
  };
}

// Category color mapping (Fullmind brand)
export const CATEGORY_COLORS = {
  renewal: "#403770",     // Plum
  expansion: "#6EA3BE",   // Steel Blue
  winback: "#F37167",     // Deep Coral
  newBusiness: "#8AA891", // Sage
} as const;

export const CATEGORY_LABELS = {
  renewal: "Renewal",
  expansion: "Expansion",
  winback: "Winback",
  newBusiness: "New Business",
} as const;
