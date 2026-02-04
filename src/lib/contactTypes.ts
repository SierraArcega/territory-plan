// Contact Types - Single source of truth for persona and seniority values
// These values are derived from actual database content (Clay-populated data)

// =============================================================================
// Persona (Department-based)
// =============================================================================

export const PERSONAS = [
  "Executive Leadership",
  "Finance & Business Operations",
  "Student Services & Support",
  "Academic Leadership",
  "Curriculum & Instruction",
  "Technology & Information Systems",
  "Human Resources",
  "Special Education",
  "Communications & Community Engagement",
  "Federal Programs & Compliance",
  "Operations & Facilities",
  "Assessment & Accountability",
  "Administrative Support",
  "Innovation & Special Programs",
  "Legal & Compliance",
] as const;

export type Persona = (typeof PERSONAS)[number];

// Persona badge colors (grouped by functional area)
export const PERSONA_COLORS: Record<Persona, { bg: string; text: string; border: string }> = {
  "Executive Leadership":                  { bg: "#403770", text: "#FFFFFF", border: "#322a5a" },
  "Academic Leadership":                   { bg: "#8AA891", text: "#FFFFFF", border: "#7a9881" },
  "Finance & Business Operations":         { bg: "#EEF5F8", text: "#3B6B83", border: "#B8D4E3" },
  "Technology & Information Systems":      { bg: "#E8F4F8", text: "#2D5A6B", border: "#B8D4E3" },
  "Human Resources":                       { bg: "#FFF3E0", text: "#B86E00", border: "#FFD699" },
  "Curriculum & Instruction":              { bg: "#EDFFE3", text: "#4A7C4E", border: "#BBE8A8" },
  "Special Education":                     { bg: "#F3E8FF", text: "#7C3AED", border: "#DDD6FE" },
  "Student Services & Support":            { bg: "#E0F2FE", text: "#0369A1", border: "#BAE6FD" },
  "Communications & Community Engagement": { bg: "#FEF3C7", text: "#B45309", border: "#FDE68A" },
  "Federal Programs & Compliance":         { bg: "#F1F5F9", text: "#475569", border: "#CBD5E1" },
  "Operations & Facilities":               { bg: "#F5F5F4", text: "#57534E", border: "#D6D3D1" },
  "Assessment & Accountability":           { bg: "#ECFDF5", text: "#047857", border: "#A7F3D0" },
  "Administrative Support":                { bg: "#F3F4F6", text: "#6B7280", border: "#E5E7EB" },
  "Innovation & Special Programs":         { bg: "#FDF4FF", text: "#A21CAF", border: "#F5D0FE" },
  "Legal & Compliance":                    { bg: "#FEF2F2", text: "#B91C1C", border: "#FECACA" },
};

// =============================================================================
// Seniority Level
// =============================================================================

export const SENIORITY_LEVELS = [
  "Executive Leadership",
  "Senior Leadership",
  "Director Level",
  "Manager/Coordinator Level",
  "Specialist Level",
  "Administrative Support",
  "School-Level Leadership",
] as const;

export type SeniorityLevel = (typeof SENIORITY_LEVELS)[number];

// Seniority badge colors (hierarchy gradient: darker = more senior)
export const SENIORITY_COLORS: Record<SeniorityLevel, { bg: string; text: string }> = {
  "Executive Leadership":       { bg: "#403770", text: "#FFFFFF" },
  "Senior Leadership":          { bg: "#5C4E8C", text: "#FFFFFF" },
  "Director Level":             { bg: "#6EA3BE", text: "#FFFFFF" },
  "Manager/Coordinator Level":  { bg: "#8AA891", text: "#FFFFFF" },
  "Specialist Level":           { bg: "#C4E7E6", text: "#403770" },
  "Administrative Support":     { bg: "#F3F4F6", text: "#6B7280" },
  "School-Level Leadership":    { bg: "#E0F2FE", text: "#0369A1" },
};

// =============================================================================
// Validation Helpers
// =============================================================================

export function isValidPersona(value: string | null | undefined): value is Persona {
  return value != null && PERSONAS.includes(value as Persona);
}

export function isValidSeniorityLevel(value: string | null | undefined): value is SeniorityLevel {
  return value != null && SENIORITY_LEVELS.includes(value as SeniorityLevel);
}

// Normalize functions for incoming data (returns null if invalid)
export function normalizePersona(value: string | null | undefined): Persona | null {
  if (!value) return null;
  return isValidPersona(value) ? value : null;
}

export function normalizeSeniorityLevel(value: string | null | undefined): SeniorityLevel | null {
  if (!value) return null;
  return isValidSeniorityLevel(value) ? value : null;
}
