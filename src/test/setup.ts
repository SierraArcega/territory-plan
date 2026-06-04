import "@testing-library/jest-dom";
import { vi, beforeEach } from "vitest";

// Lists ships gated OFF in production (see features/views/lib/feature-flags.ts).
// Enable it for the unit suite so tests exercise the full Views + Lists feature.
process.env.NEXT_PUBLIC_LISTS_ENABLED = "true";

// Mock fetch for API tests
global.fetch = vi.fn();

// Mock window.matchMedia (not implemented by jsdom) — defaults to non-mobile
Object.defineProperty(window, "matchMedia", {
  writable: true,
  value: vi.fn((query: string) => ({
    matches: false,
    media: query,
    onchange: null,
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    dispatchEvent: vi.fn(),
    addListener: vi.fn(),
    removeListener: vi.fn(),
  })),
});

// jsdom doesn't implement PointerEvent; extend MouseEvent so pointer events
// carry clientX/clientY through to React handlers (needed by drag interactions).
if (typeof window.PointerEvent === "undefined") {
  class PointerEventPolyfill extends MouseEvent {
    readonly pointerId: number;
    constructor(type: string, props: PointerEventInit = {}) {
      super(type, props);
      this.pointerId = props.pointerId ?? 0;
    }
  }
  window.PointerEvent = PointerEventPolyfill as unknown as typeof PointerEvent;
}

// Reset mocks between tests
beforeEach(() => {
  vi.clearAllMocks();
});
