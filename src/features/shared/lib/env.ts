/** Reads a required env var, throwing a named error when absent — so missing
 *  config fails loudly at the call site instead of as an undefined downstream. */
export function requireEnv(name: string): string {
  const v = process.env[name];
  if (!v) throw new Error(`Missing required env var: ${name}`);
  return v;
}
