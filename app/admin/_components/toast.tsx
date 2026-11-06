"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, useSyncExternalStore, type ReactNode } from "react";

import { Icon } from "@/components/icons";
import { Button } from "@/components/ui/button";
import { dismissToast, pushToast, type Toast, type ToastAction } from "@/interface/admin/toasts";

import { IDENTITY_MENU_OPEN_ATTRIBUTE } from "../../_components/identity-chip";

const DISMISS_AFTER_MS = 5000;

interface ToastApi {
  /**
   * Shows a short success message; it disappears on its own. Errors stay inline where they happened.
   * An `action` adds a button (e.g. "Deshacer") that runs once and closes the toast.
   */
  notify: (message: string, action?: ToastAction) => void;
}

// Outside a provider (an isolated render) the call does nothing instead of throwing.
const ToastContext = createContext<ToastApi>({ notify: () => undefined });

export function useToast(): ToastApi {
  return useContext(ToastContext);
}

function subscribeToIdentityMenu(onChange: () => void) {
  const observer = new MutationObserver(onChange);

  observer.observe(document.documentElement, { attributes: true, attributeFilter: [IDENTITY_MENU_OPEN_ATTRIBUTE] });

  return () => observer.disconnect();
}

/** The open identity menu can cover a toast, so the toasts wait while it is open. */
function useIdentityMenuOpen(): boolean {
  return useSyncExternalStore(
    subscribeToIdentityMenu,
    () => document.documentElement.hasAttribute(IDENTITY_MENU_OPEN_ATTRIBUTE),
    () => false,
  );
}

function ToastItem({ toast, onDismiss }: { toast: Toast; onDismiss: (id: number) => void }) {
  const [paused, setPaused] = useState(false);
  const [acted, setActed] = useState(false);

  const menuOpen = useIdentityMenuOpen();
  const remaining = useRef(DISMISS_AFTER_MS);

  // Hovering or focusing a toast, or opening the identity menu over it, stops its clock; it resumes with the time left.
  useEffect(() => {
    if (paused || menuOpen) return;

    const startedAt = Date.now();
    const timer = setTimeout(() => onDismiss(toast.id), remaining.current);

    return () => {
      clearTimeout(timer);
      remaining.current = Math.max(0, remaining.current - (Date.now() - startedAt));
    };
  }, [paused, menuOpen, toast.id, onDismiss]);

  return (
    <li
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
      onFocus={() => setPaused(true)}
      onBlur={() => setPaused(false)}
      className="pointer-events-auto flex items-center gap-3 rounded border border-sky bg-card py-2 pr-1.5 pl-4 text-sm font-semibold shadow-lg"
    >
      <Icon name="check" className="size-4 shrink-0 stroke-[2.25] text-sky" />
      <span className="min-w-0 flex-1 wrap-anywhere">{toast.message}</span>
      {toast.action ? (
        <Button
          variant="line"
          size="sm"
          disabled={acted}
          onClick={() => {
            if (acted) return;

            setActed(true);
            toast.action?.onAction();
            onDismiss(toast.id);
          }}
        >
          {toast.action.label}
        </Button>
      ) : null}
      <Button variant="quiet" size="icon-sm" onClick={() => onDismiss(toast.id)} className="border-transparent">
        <Icon name="x" className="size-4" />
        <span className="sr-only">Cerrar aviso</span>
      </Button>
    </li>
  );
}

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const nextId = useRef(0);

  const notify = useCallback((message: string, action?: ToastAction) => {
    nextId.current += 1;
    const toast: Toast = { id: nextId.current, message, ...(action && { action }) };

    setToasts((previous) => pushToast(previous, toast));
  }, []);
  const dismiss = useCallback((id: number) => setToasts((previous) => dismissToast(previous, id)), []);
  const api = useMemo(() => ({ notify }), [notify]);

  return (
    <ToastContext.Provider value={api}>
      {children}
      {/* The live region is always mounted, so a message added to it is announced. It stacks under the top bar (z-30), so the open identity menu is drawn over it. */}
      <div aria-live="polite" role="status" className="pointer-events-none fixed inset-x-4 top-16 z-20 lg:inset-x-auto lg:top-18 lg:right-6 lg:w-96">
        <ul className="grid gap-2">
          {toasts.map((toast) => (
            <ToastItem key={toast.id} toast={toast} onDismiss={dismiss} />
          ))}
        </ul>
      </div>
    </ToastContext.Provider>
  );
}
