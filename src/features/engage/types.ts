export type StepType = "email" | "call" | "text" | "linkedin";
export type ExecutionStatus = "active" | "paused" | "completed" | "cancelled";
export type StepExecutionStatus = "pending" | "completed" | "skipped" | "failed";
export type MergeFieldType = "system" | "custom";

export const STEP_TYPE_LABELS: Record<StepType, string> = {
  email: "Email",
  call: "Phone Call",
  text: "Text Message",
  linkedin: "LinkedIn",
};

export const EXECUTION_STATUS_CONFIG: Record<
  ExecutionStatus,
  { label: string; color: string; bgColor: string }
> = {
  active: { label: "Active", color: "#22C55E", bgColor: "#F0FDF4" },
  paused: { label: "Paused", color: "#F59E0B", bgColor: "#FFFBEB" },
  completed: { label: "Completed", color: "#6EA3BE", bgColor: "#EEF5F8" },
  cancelled: { label: "Cancelled", color: "#94A3B8", bgColor: "#F1F5F9" },
};

export const SYSTEM_MERGE_FIELDS = {
  "contact.first_name": { label: "First Name", source: "contact" },
  "contact.last_name": { label: "Last Name", source: "contact" },
  "contact.full_name": { label: "Full Name", source: "contact" },
  "contact.title": { label: "Job Title", source: "contact" },
  "contact.email": { label: "Email", source: "contact" },
  "contact.phone": { label: "Phone", source: "contact" },
  "district.name": { label: "District Name", source: "district" },
  "district.state": { label: "State", source: "district" },
  "district.city": { label: "City", source: "district" },
  "district.enrollment": { label: "Enrollment", source: "district" },
  "district.leaid": { label: "LEA ID", source: "district" },
  "district.pipeline": { label: "Pipeline", source: "district" },
  "district.bookings": { label: "Bookings", source: "district" },
  "district.invoicing": { label: "Invoicing", source: "district" },
  "district.sessions_revenue": { label: "Sessions Revenue", source: "district" },
  "sender.name": { label: "My Name", source: "sender" },
  "sender.email": { label: "My Email", source: "sender" },
  "sender.title": { label: "My Title", source: "sender" },
  "date.today": { label: "Today's Date", source: "date" },
  "date.current_month": { label: "Current Month", source: "date" },
  "date.current_year": { label: "Current Year", source: "date" },
} as const;

export type SystemMergeFieldKey = keyof typeof SYSTEM_MERGE_FIELDS;

export interface EngageTemplate {
  id: number;
  name: string;
  type: StepType;
  subject: string | null;
  body: string;
  createdByUserId: string;
  isArchived: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface SequenceStepData {
  id: number;
  sequenceId: number;
  templateId: number | null;
  type: StepType;
  subject: string | null;
  body: string | null;
  position: number;
  delayDays: number;
  template: EngageTemplate | null;
}

export interface SequenceData {
  id: number;
  name: string;
  description: string | null;
  createdByUserId: string;
  isArchived: boolean;
  steps: SequenceStepData[];
  mergeFieldDefs: MergeFieldDefData[];
  createdAt: string;
  updatedAt: string;
  _count?: { executions: number };
}

export interface MergeFieldDefData {
  id: number;
  sequenceId: number;
  name: string;
  label: string;
  type: MergeFieldType;
  sourceField: string | null;
  defaultValue: string | null;
}

export interface SequenceExecutionData {
  id: number;
  sequenceId: number;
  userId: string;
  status: ExecutionStatus;
  currentStepPosition: number;
  currentContactIndex: number;
  contactCount: number;
  completedCount: number;
  startedAt: string;
  completedAt: string | null;
  sequence: { name: string; steps: SequenceStepData[] };
}

export interface StepExecutionData {
  id: number;
  executionId: number;
  stepId: number;
  contactId: number;
  status: StepExecutionStatus;
  sentBody: string | null;
  sentSubject: string | null;
  gmailMessageId: string | null;
  activityId: string | null;
  notes: string | null;
  completedAt: string | null;
  contact: {
    id: number;
    name: string;
    email: string | null;
    title: string | null;
    leaid: string;
  };
}

export interface ExecutionContact {
  contactId: number;
  name: string;
  email: string | null;
  title: string | null;
  leaid: string;
  districtName: string;
  customFields: Record<string, string>;
}
