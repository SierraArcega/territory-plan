"use client";

// Toast — app-wide transient feedback messages.
//
// Mount <ToastProvider> once near the app root, then call:
//   const { showToast } = useToast();
//   showToast("Lead accepted", { tone: "success" });
//
// Toasts stack bottom-center, auto-dismiss after ~3.2s, and can be dismissed
// early by clicking. Visuals follow the leads design handoff (LeadsView.jsx
// toast): plum #403770 card, white text, radius 10, plum-tinted shadow. The
// three tones differentiate via the icon on the plum card — success (mint
// CheckCircle2 #9FE0B0), info (steel-tint Info #8BB5CB), alert (coral-tint
// AlertTriangle #F7C9C5).

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { AlertTriangle, CheckCircle2, Info } from "lucide-react";
import { Portal } from "@/features/shared/lib/portal";

export type ToastTone = "success" | "info" | "alert";

export interface ToastOptions {
  tone?: ToastTone;
  /** Auto-dismiss delay in ms (default 3200). */
  duration?: number;
}

interface ToastItem {
  id: number;
  message: string;
  tone: ToastTone;
}

interface ToastContextValue {
  showToast: (message: string, options?: ToastOptions) => void;
}

const ToastContext = createContext<ToastContextValue | null>(null);

export function useToast(): ToastContextValue {
  const ctx = useContext(ToastContext);
  if (!ctx) {
    throw new Error("useToast must be used within a <ToastProvider>");
  }
  return ctx;
}

const DEFAULT_DURATION_MS = 3200;

const TONE_STYLES: Record<ToastTone, { icon: typeof Info; iconColor: string }> = {
  success: { icon: CheckCircle2, iconColor: "text-[#9FE0B0]" },
  info: { icon: Info, iconColor: "text-[#8BB5CB]" },
  alert: { icon: AlertTriangle, iconColor: "text-[#F7C9C5]" },
};

let nextToastId = 1;

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<ToastItem[]>([]);
  const timersRef = useRef(new Map<number, ReturnType<typeof setTimeout>>());

  const dismissToast = useCallback((id: number) => {
    const timer = timersRef.current.get(id);
    if (timer) {
      clearTimeout(timer);
      timersRef.current.delete(id);
    }
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const showToast = useCallback(
    (message: string, options?: ToastOptions) => {
      const id = nextToastId++;
      setToasts((prev) => [
        ...prev,
        { id, message, tone: options?.tone ?? "info" },
      ]);
      timersRef.current.set(
        id,
        setTimeout(
          () => dismissToast(id),
          options?.duration ?? DEFAULT_DURATION_MS,
        ),
      );
    },
    [dismissToast],
  );

  // Clear pending timers if the provider unmounts.
  useEffect(() => {
    const timers = timersRef.current;
    return () => {
      timers.forEach((t) => clearTimeout(t));
      timers.clear();
    };
  }, []);

  const value = useMemo(() => ({ showToast }), [showToast]);

  return (
    <ToastContext.Provider value={value}>
      {children}
      {toasts.length > 0 && (
        <Portal>
          <style>{`@keyframes fm-toast-up { from { opacity: 0; transform: translateY(8px); } to { opacity: 1; transform: translateY(0); } }`}</style>
          <div
            role="status"
            aria-live="polite"
            className="fixed bottom-6 left-1/2 z-50 flex -translate-x-1/2 flex-col items-center gap-2"
          >
            {toasts.map((toast) => {
              const tone = TONE_STYLES[toast.tone];
              const ToneIcon = tone.icon;
              return (
                <button
                  key={toast.id}
                  type="button"
                  onClick={() => dismissToast(toast.id)}
                  aria-label={`Dismiss: ${toast.message}`}
                  className="flex max-w-[min(92vw,480px)] cursor-pointer items-center gap-[9px] rounded-[10px] bg-[#403770] px-4 py-[11px] text-left text-[13px] font-medium text-white shadow-[0_8px_24px_-6px_rgba(64,55,112,0.5)]"
                  style={{
                    animation:
                      "fm-toast-up 220ms cubic-bezier(0.16,1,0.3,1)",
                  }}
                >
                  <ToneIcon
                    size={15}
                    className={`shrink-0 ${tone.iconColor}`}
                    aria-hidden
                  />
                  <span className="min-w-0">{toast.message}</span>
                </button>
              );
            })}
          </div>
        </Portal>
      )}
    </ToastContext.Provider>
  );
}
