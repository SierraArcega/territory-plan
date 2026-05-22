import "@testing-library/jest-dom";
import { vi, beforeEach } from "vitest";

// Lists ships gated OFF in production (see features/views/lib/feature-flags.ts).
// Enable it for the unit suite so tests exercise the full Views + Lists feature.
process.env.NEXT_PUBLIC_LISTS_ENABLED = "true";

// Mock fetch for API tests
global.fetch = vi.fn();

// Reset mocks between tests
beforeEach(() => {
  vi.clearAllMocks();
});
