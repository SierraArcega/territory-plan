"use client";

import React, { Component, type ErrorInfo, type ReactNode } from "react";

interface FallbackRenderProps {
  error: Error;
  resetErrorBoundary: () => void;
}

interface ErrorBoundaryProps {
  children: ReactNode;
  fallback?: ReactNode | ((props: FallbackRenderProps) => ReactNode);
}

interface ErrorBoundaryState {
  error: Error | null;
}

/**
 * Catch rendering errors in child components and display a fallback UI.
 * Default fallback uses Fullmind brand tokens.
 *
 * @example
 * <ErrorBoundary>
 *   <MyComponent />
 * </ErrorBoundary>
 *
 * @example
 * <ErrorBoundary fallback={({ error, resetErrorBoundary }) => (
 *   <div>
 *     <p>Error: {error.message}</p>
 *     <button onClick={resetErrorBoundary}>Retry</button>
 *   </div>
 * )}>
 *   <MyComponent />
 * </ErrorBoundary>
 */
export class ErrorBoundary extends Component<
  ErrorBoundaryProps,
  ErrorBoundaryState
> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = { error: null };
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error("ErrorBoundary caught:", error, info);
  }

  resetErrorBoundary = () => {
    this.setState({ error: null });
  };

  render() {
    const { error } = this.state;
    const { children, fallback } = this.props;

    if (error) {
      // Custom fallback: render function
      if (typeof fallback === "function") {
        return fallback({
          error,
          resetErrorBoundary: this.resetErrorBoundary,
        });
      }
      // Custom fallback: ReactNode
      if (fallback) {
        return fallback;
      }
      // Default fallback: Fullmind-styled error card
      return (
        <div className="rounded-lg shadow-sm border border-[#D4CFE2] p-5 text-center">
          <h3 className="text-lg font-semibold text-[#403770] mb-2">
            Something went wrong
          </h3>
          <p className="text-sm text-[#8A80A8] mb-4">
            An unexpected error occurred. Please try again.
          </p>
          <button
            onClick={this.resetErrorBoundary}
            className="px-4 py-2 rounded-lg bg-[#F37167] text-white text-sm font-medium hover:bg-[#e0635a] transition-colors"
          >
            Try again
          </button>
        </div>
      );
    }

    return children;
  }
}
