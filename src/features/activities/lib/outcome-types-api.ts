// Types used by the outcome modal components and their associated query hooks.
// Separated from components to avoid circular imports.

export interface OpportunityResult {
  id: string;
  name: string;
  stage: string | null;
  netBookingAmount: number | null;
  districtName: string | null;
  districtLeaId: string | null;
  closeDate: string | null;
}

export interface CalendarAttendee {
  email: string;
  displayName: string | null;
  responseStatus: string | null;
  matchedDistrict: { leaid: string; name: string } | null;
  existingContact: { id: number; name: string } | null;
}

export interface AttendeeSelection {
  email: string;
  displayName: string | null;
  checked: boolean;
  district: { leaid: string; name: string } | null;
  existingContactId: number | null;
}
