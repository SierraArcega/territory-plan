/**
 * Feature flags for the Views feature.
 *
 * LISTS_ENABLED gates the saved-Lists UI — the sidebar Lists section, the list
 * builder ("Save as list" / the builder modal), and the /views/lists/* routes.
 * Lists ships dark while it's still being built; Views (plans) is the only
 * surface live in production.
 *
 * Defaults OFF everywhere (including production) so Lists can never leak by
 * accident — an unset env var keeps it hidden. To work on Lists locally, set
 * in .env.local:
 *
 *   NEXT_PUBLIC_LISTS_ENABLED=true
 *
 * The vitest suite sets the same var (src/test/setup.ts) so the Lists tests
 * keep exercising the full feature. When Lists is ready to ship, flip the
 * default here (or remove the gate) in its own PR.
 */
export const LISTS_ENABLED = process.env.NEXT_PUBLIC_LISTS_ENABLED === "true";
