import "@testing-library/jest-dom";
import { vi, beforeEach } from "vitest";

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

// Reset mocks between tests
beforeEach(() => {
  vi.clearAllMocks();
});
