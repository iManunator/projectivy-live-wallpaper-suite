import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from "react";

export type ToastKind = "ok" | "error" | "info";
export type Toast = { id: number; kind: ToastKind; text: string };

type ToastFn = (kind: ToastKind, text: string) => void;

const ToastContext = createContext<ToastFn>(() => undefined);

let nextId = 1;

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const notify = useCallback<ToastFn>((kind, text) => {
    const id = nextId++;
    setToasts((current) => [...current.slice(-4), { id, kind, text }]);
    window.setTimeout(() => {
      setToasts((current) => current.filter((toast) => toast.id !== id));
    }, 7000);
  }, []);
  const value = useMemo(() => notify, [notify]);
  return (
    <ToastContext.Provider value={value}>
      {children}
      <div className="toasts" aria-live="polite">
        {toasts.map((toast) => (
          <div key={toast.id} className={`toast toast-${toast.kind}`} role="status">
            <span>{toast.text}</span>
            <button
              type="button"
              className="toast-dismiss"
              aria-label="Dismiss"
              onClick={() => setToasts((current) => current.filter((row) => row.id !== toast.id))}
            >
              ×
            </button>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}

export function useToasts(): ToastFn {
  return useContext(ToastContext);
}
