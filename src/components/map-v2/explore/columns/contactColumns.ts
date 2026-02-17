// Column definitions for the Contacts entity in the Explore data table.
// Keys match the field names returned by GET /api/explore/contacts.

export interface ColumnDef {
  key: string;
  label: string;
  group: string;
  isDefault: boolean;
  filterType: "text" | "enum" | "number" | "boolean" | "date" | "tags";
  enumValues?: string[];
}

export interface ContactRow {
  id: string;
  name: string;
  title: string | null;
  email: string | null;
  phone: string | null;
  isPrimary: boolean;
  districtName: string;
  districtLeaid: string;
  lastActivity: string | null;
}

export const contactColumns: ColumnDef[] = [
  // ---- Core ----
  {
    key: "name",
    label: "Name",
    group: "Core",
    isDefault: true,
    filterType: "text",
  },
  {
    key: "title",
    label: "Title",
    group: "Core",
    isDefault: true,
    filterType: "text",
  },
  {
    key: "email",
    label: "Email",
    group: "Core",
    isDefault: true,
    filterType: "text",
  },
  {
    key: "phone",
    label: "Phone",
    group: "Core",
    isDefault: true,
    filterType: "text",
  },

  // ---- Association ----
  {
    key: "districtName",
    label: "District",
    group: "Association",
    isDefault: true,
    filterType: "text",
  },
  {
    key: "districtLeaid",
    label: "District LEA ID",
    group: "Association",
    isDefault: false,
    filterType: "text",
  },

  // ---- Status ----
  {
    key: "isPrimary",
    label: "Primary Contact",
    group: "Status",
    isDefault: true,
    filterType: "boolean",
  },

  // ---- Engagement ----
  {
    key: "lastActivity",
    label: "Last Activity",
    group: "Engagement",
    isDefault: true,
    filterType: "date",
  },
];
