const MERGE_FIELD_REGEX = /\{\{(\w+(?:\.\w+)*)\}\}/g;

/**
 * Extract unique merge field keys from template text.
 * "Hi {{contact.first_name}}" → ["contact.first_name"]
 */
export function extractMergeFieldKeys(text: string): string[] {
  const keys = new Set<string>();
  let match;
  while ((match = MERGE_FIELD_REGEX.exec(text)) !== null) {
    keys.add(match[1]);
  }
  MERGE_FIELD_REGEX.lastIndex = 0;
  return Array.from(keys);
}

export interface MergeContext {
  contact: Record<string, string>;
  district: Record<string, string>;
  sender: Record<string, string>;
  date: Record<string, string>;
  custom: Record<string, string>;
}

/**
 * Resolve merge fields in template text using the provided context.
 * System fields use dotted notation: {{contact.first_name}} → context.contact.first_name
 * Custom fields use plain names: {{talking_point}} → context.custom.talking_point
 * Unresolved fields are left as-is: {{unknown}} stays as {{unknown}}
 */
export function resolveMergeFields(
  template: string,
  context: MergeContext
): string {
  if (!template) return template;

  return template.replace(MERGE_FIELD_REGEX, (match, key: string) => {
    const dotIndex = key.indexOf(".");
    if (dotIndex !== -1) {
      const category = key.slice(0, dotIndex) as keyof Omit<
        MergeContext,
        "custom"
      >;
      const field = key.slice(dotIndex + 1);
      const value = context[category]?.[field];
      if (value !== undefined && value !== null && value !== "") return value;
    }

    const customValue = context.custom[key];
    if (customValue !== undefined && customValue !== null && customValue !== "")
      return customValue;

    return match;
  });
}

/**
 * Check if text contains any unresolved merge field placeholders.
 */
export function hasUnresolvedFields(text: string): boolean {
  MERGE_FIELD_REGEX.lastIndex = 0;
  return MERGE_FIELD_REGEX.test(text);
}
