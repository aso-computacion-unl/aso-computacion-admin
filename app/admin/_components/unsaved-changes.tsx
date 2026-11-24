"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  createContext,
  useContext,
  useEffect,
  useEffectEvent,
  useId,
  useRef,
  useState,
  type ComponentProps,
  type KeyboardEvent,
  type MouseEvent,
  type ReactNode,
  type RefObject,
  type SubmitEvent,
} from "react";
import { createPortal } from "react-dom";

import { Button } from "@/components/ui/button";

import { useHasUnsavedChanges, useUnsavedState } from "./use-controlled-form";

interface LeaveRequest {
  /** Where «Salir sin guardar» goes: an in-app address, or what to do instead (submit the sign-out form). */
  leave: string | (() => void);
  /** Takes the focus back when the owner keeps editing. */
  returnTo: HTMLElement | null;
}

const AskToLeave = createContext<((request: LeaveRequest) => void) | null>(null);

/** Marks the links that ask on their own (`GuardedLink`), so the provider's listener leaves their clicks to them. */
const GUARDED_LINK_ATTRIBUTE = "data-unsaved-guard";

/**
 * The one "leave without saving?" question of the admin, mounted once by the layout. While a form holds unsaved
 * changes it asks here instead of leaving: a `GuardedLink`, a `GuardedForm` (the sign-out), and any other same-site
 * link of the admin (the top bar's logo, the links inside a page's own content), caught by one click listener on the
 * document. «Salir sin guardar» then goes where the link pointed. The question goes away by itself when nothing is
 * left unsaved (a save landed, or the text was typed back).
 */
export function UnsavedChangesProvider({ children }: { children: ReactNode }) {
  const [request, setRequest] = useState<LeaveRequest | null>(null);
  const state = useUnsavedState();
  const router = useRouter();

  // A save that stored everything, or the original text typed back, leaves nothing to ask about.
  if (request && state === "clean") setRequest(null);

  // Capture phase: it has to stop the click before `next/link` starts the route change in its own handler.
  const askForPlainLink = useEffectEvent((event: globalThis.MouseEvent) => {
    if (state !== "unsaved" || event.defaultPrevented) return;

    const link = event.target instanceof Element ? event.target.closest("a[href]") : null;

    if (!(link instanceof HTMLAnchorElement) || link.hasAttribute(GUARDED_LINK_ATTRIBUTE) || opensElsewhere(event, link)) return;

    const href = inAppDestination(link);

    if (href === null) return;
    event.preventDefault();
    setRequest({ leave: href, returnTo: link });
  });

  useEffect(() => {
    const listener = (event: globalThis.MouseEvent) => askForPlainLink(event);

    document.addEventListener("click", listener, true);

    return () => document.removeEventListener("click", listener, true);
  }, []);

  return (
    <AskToLeave value={setRequest}>
      {children}
      {request ? (
        <LeaveDialog
          returnTo={request.returnTo}
          onKeepEditing={() => setRequest(null)}
          onLeave={() => {
            setRequest(null);
            if (typeof request.leave === "string") router.push(request.leave);
            else request.leave();
          }}
        />
      ) : null}
    </AskToLeave>
  );
}

/**
 * The address a link would load in this tab, for the router: `null` when the click does not leave the page (a jump to
 * a part of it) or leaves the app (another site, `mailto:`), which the browser handles as usual.
 */
function inAppDestination(link: HTMLAnchorElement): string | null {
  const url = new URL(link.href, window.location.href);
  const here = window.location;

  if (url.origin !== here.origin) return null;
  if (url.hash !== "" && url.pathname === here.pathname && url.search === here.search) return null;

  return `${url.pathname}${url.search}${url.hash}`;
}

/** A click the browser itself sends somewhere else (a new tab or window, a download): this page stays, so nothing is lost. */
function opensElsewhere(event: MouseEvent | globalThis.MouseEvent, link: HTMLAnchorElement): boolean {
  const target = link.getAttribute("target");

  return event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey || (target !== null && target !== "_self") || link.hasAttribute("download");
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
      {...{ [GUARDED_LINK_ATTRIBUTE]: "" }}
      href={href}
      onClick={(event) => {
        onClick?.(event);
        if (event.defaultPrevented || !ask || !unsaved || opensElsewhere(event, event.currentTarget)) return;

        event.preventDefault();
        ask({ leave: href, returnTo: returnFocusTo?.current ?? event.currentTarget });
      }}
    />
  );
}

/**
 * A form that leaves the page when it is sent (the admin's «Cerrar sesión»): while a form of the page holds unsaved
 * changes it asks first, and «Salir sin guardar» sends it. Without unsaved changes, or outside the admin, a plain form.
 */
export function GuardedForm({ onSubmit, ...props }: ComponentProps<"form">) {
  const ask = useContext(AskToLeave);
  const unsaved = useHasUnsavedChanges();
  const confirmed = useRef(false);

  function handleSubmit(event: SubmitEvent<HTMLFormElement>) {
    onSubmit?.(event);
    if (confirmed.current) {
      confirmed.current = false;

      return;
    }
    if (event.defaultPrevented || !ask || !unsaved) return;

    const form = event.currentTarget;
    const submitter = event.submitter;

    // Stopping the submit event also stops React from calling the form's action.
    event.preventDefault();
    ask({
      leave: () => {
        confirmed.current = true;
        form.requestSubmit(submitter);
      },
      returnTo: submitter ?? form,
    });
  }

  return <form {...props} onSubmit={handleSubmit} />;
}

/**
 * Gives the focus back to what asked. When that sits in a disclosure that closed meanwhile (the identity menu closes
 * as the focus moves to the dialog), the focus goes to the button that opens it, the one whose `aria-controls` names it.
 */
function focusBack(returnTo: HTMLElement | null) {
  const closed = returnTo?.closest<HTMLElement>("[hidden]");
  const opener = closed?.id ? [...document.querySelectorAll<HTMLElement>("[aria-controls]")].find((element) => element.getAttribute("aria-controls") === closed.id) : undefined;

  (opener ?? returnTo)?.focus();
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
      if (!leaving.current) focusBack(returnTo);
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
