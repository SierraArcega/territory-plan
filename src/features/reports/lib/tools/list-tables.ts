import { TABLE_REGISTRY } from "@/lib/district-column-metadata";

export async function handleListTables(): Promise<string> {
  const lines = Object.values(TABLE_REGISTRY).map(
    (t) => `- ${t.table}: ${t.description}`,
  );
  return lines.join("\n");
}
