"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { createContext, useContext, useEffect, useId, useRef, useState, type ComponentProps, type KeyboardEvent, type MouseEvent, type ReactNode, type RefObject } from "react";
import { createPortal } from "react-dom";

import { Button } from "@/components/ui/button";

import { useHasUnsavedChanges, useUnsavedState } from "./use-controlled-form";

interface LeaveRequest {
  href: string;
  /** Takes the focus back when the owner keeps editing. */
  returnTo: HTMLElement | null;
}

const AskToLeave = createContext<((request: LeaveRequest) => void) | null>(null);

/**
 * The one "leave without saving?" question of the admin, mounted once by the layout. A `GuardedLink` under it asks here
 * instead of leaving while a form holds unsaved changes; «Salir sin guardar» then goes where the link pointed. The
 * question goes away by itself when nothing is left unsaved (a save landed, or the text was typed back).
 */
export function UnsavedChangesProvider({ children }: { children: ReactNode }) {
  const [request, setRequest] = useState<LeaveRequest | null>(null);
  const state = useUnsavedState();
  const router = useRouter();

  // A save that stored everything, or the original text typed back, leaves nothing to ask about.
  if (request && state === "clean") setRequest(null);

  return (
    <AskToLeave value={setRequest}>
      {children}
      {request ? (
        <LeaveDialog
          returnTo={request.returnTo}
          onKeepEditing={() => setRequest(null)}
          onLeave={() => {
            setRequest(null);
            router.push(request.href);
          }}
        />
      ) : null}
    </AskToLeave>
  );
}

/** A click the browser itself sends somewhere else (a new tab or window, a download): this page stays, so nothing is lost. */
function opensElsewhere(event: MouseEvent<HTMLAnchorElement>): boolean {
  const target = event.currentTarget.getAttribute("target");

  return event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey || (target !== null && target !== "_self") || event.currentTarget.hasAttribute("download");
}

type GuardedLinkProps = Omit<ComponentProps<typeof Link>, "href"> & {
  href: string;
  /** What takes the focus back when the owner keeps editing, when it is not the link (e.g. the link sits in a menu that closes). */
  returnFocusTo?: RefObject<HTMLElement | null>;
};

/**
 * An in-app link of the admin that asks before it leaves unsaved changes behind. Without unsaved changes, or for a
 * click that opens another tab or window (Ctrl, ⌘, Shift, Alt, the middle button, `target`), it is a plain link.
 */
export function GuardedLink({ href, onClick, returnFocusTo, ...props }: GuardedLinkProps) {
  const ask = useContext(AskToLeave);
  const unsaved = useHasUnsavedChanges();

  return (
    <Link
      {...props}
      href={href}
      onClick={(event) => {
        onClick?.(event);
        if (event.defaultPrevented || !ask || !unsaved || opensElsewhere(event)) return;

        event.preventDefault();
        ask({ href, returnTo: returnFocusTo?.current ?? event.currentTarget });
      }}
    />
  );
}

interface LeaveDialogProps {
  returnTo: HTMLElement | null;
  onKeepEditing: () => void;
  onLeave: () => void;
}

/**
 * Modal over the whole admin: the safe choice («Seguir editando») has the focus, Tab stays inside, Escape keeps
 * editing, and staying gives the focus back to the link that asked. It sits in `body` so no ancestor can clip it.
 */
function LeaveDialog({ returnTo, onKeepEditing, onLeave }: LeaveDialogProps) {
  const titleId = useId();
  const detailId = useId();
  const root = useRef<HTMLDivElement>(null);
  const stay = useRef<HTMLButtonElement>(null);
  const leaving = useRef(false);

  useEffect(() => {
    stay.current?.focus();

    return () => {
      if (!leaving.current) returnTo?.focus();
    };
  }, [returnTo]);

  function handleKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    if (event.key === "Escape") {
      event.preventDefault();
      onKeepEditing();

      return;
    }
    if (event.key !== "Tab") return;

    const buttons = Array.from(root.current?.querySelectorAll<HTMLButtonElement>("button") ?? []);
    const index = buttons.indexOf(document.activeElement as HTMLButtonElement);
    const next = (index + (event.shiftKey ? -1 : 1) + buttons.length) % buttons.length;

    event.preventDefault();
    buttons[next]?.focus();
  }

  return createPortal(
    <div className="fixed inset-0 z-100 grid place-items-center bg-deep/60 p-4">
      <div
        ref={root}
        role="alertdialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={detailId}
        onKeyDown={handleKeyDown}
        className="grid w-full max-w-md gap-3 rounded border-2 border-foreground bg-card p-5 text-foreground shadow-[6px_6px_0_var(--color-signal)]"
      >
        <h2 id={titleId} className="text-base font-[650]">
          ¿Salir sin guardar?
        </h2>
        <p id={detailId} className="text-sm">
          Tiene cambios sin guardar. Si sale ahora, se perderán.
        </p>
        <div className="flex flex-wrap justify-end gap-2.5">
          <Button ref={stay} type="button" variant="line" onClick={onKeepEditing}>
            Seguir editando
          </Button>
          <Button
            type="button"
            variant="danger"
            onClick={() => {
              leaving.current = true;
              onLeave();
            }}
          >
            Salir sin guardar
          </Button>
        </div>
      </div>
    </div>,
    document.body,
  );
}
