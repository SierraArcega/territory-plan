export const ACCOUNT_TYPES = [
  {
    value: "district",
    label: "District",
    tooltip: "Traditional public school district (K-12 LEA)",
  },
  {
    value: "cmo",
    label: "Charter/CMO",
    tooltip: "Charter management organization operating multiple charter schools",
  },
  {
    value: "esa_boces",
    label: "ESA/BOCES",
    tooltip: "Regional education service agency supporting multiple districts",
  },
  {
    value: "cooperative",
    label: "Cooperative",
    tooltip: "Purchasing cooperative where districts pool buying power",
  },
  {
    value: "private_school",
    label: "Private School",
    tooltip: "Private or parochial school",
  },
  {
    value: "state_agency",
    label: "State Agency",
    tooltip: "State department of education or board",
  },
  {
    value: "university",
    label: "University",
    tooltip: "College or university",
  },
  {
    value: "organization",
    label: "Organization",
    tooltip: "Other education-related organization",
  },
  {
    value: "other",
    label: "Other",
    tooltip: "Doesn't fit the above categories",
  },
] as const;

export type AccountTypeValue = (typeof ACCOUNT_TYPES)[number]["value"];

export function getAccountTypeLabel(value: string): string {
  const found = ACCOUNT_TYPES.find((t) => t.value === value);
  return found ? found.label : value;
}

export function isNonDistrictAccount(accountType: string): boolean {
  return accountType !== "district";
}
