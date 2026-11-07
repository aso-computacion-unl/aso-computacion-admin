"use client";

import { useEffect, useId, useRef, useState, type FormEvent, type KeyboardEvent, type ReactNode } from "react";
import { createPortal } from "react-dom";

import { Button } from "@/components/ui/button";
import { Segmented } from "@/components/ui/segmented";
import type { ActionResult } from "@/interface/admin/action-result";

import { changeText, diffFields, type PublishField } from "./publish-diff";

export const PUBLISHED_MESSAGE = "Publicado. El sitio se actualiza en un minuto.";

type Flow = { step: "closed" } | { step: "asking"; opener: HTMLElement | null } | { step: "sending"; opener: HTMLElement | null; from: ActionResult | null };

interface PublishFlowForm {
  state: ActionResult | null;
  /** The form's `review` and `submit` (see `useControlledForm`): check the fields without sending, then send. */
  review: (event: FormEvent<HTMLFormElement>) => boolean;
  submit: () => void;
}

/**
 * "Publicar" does not send the form: it checks the fields and, when they pass, asks with the preview.
 * "Sí, publicar" sends it as any save does. The server's answer closes the preview: a refusal's errors are
 * then in the form, in sight.
 */
export function usePublishFlow({ state, review, submit }: PublishFlowForm) {
  const [flow, setFlow] = useState<Flow>({ step: "closed" });

  if (flow.step === "sending" && state !== flow.from) setFlow({ step: "closed" });

  return {
    open: flow.step !== "closed",
    /** The form's `onSubmit` while the item is or will be published. */
    ask(event: FormEvent<HTMLFormElement>) {
      const opener = (event.nativeEvent as SubmitEvent).submitter ?? (document.activeElement as HTMLElement | null);

      if (review(event)) setFlow({ step: "asking", opener });
    },
    /** What `PublishPreview` takes besides the item. */
    dialog: {
      sending: flow.step === "sending",
      returnTo: flow.step === "closed" ? null : flow.opener,
      onKeepEditing: () => setFlow({ step: "closed" }),
      onConfirm() {
        if (flow.step !== "asking") return;

        submit();
        setFlow({ step: "sending", opener: flow.opener, from: state });
      },
    },
  };
}

/** A value that changes on the site: highlighted, with a word as well so the colour is not the only cue. */
export function Changed({ on, children }: { on: boolean; children: ReactNode }) {
  if (!on) return children;

  return (
    <>
      <mark className="rounded-xs bg-tint-blue px-0.5 text-on-tint-blue underline decoration-[1.5px] decoration-dotted underline-offset-4">{children}</mark>
      <span className="ml-2 rounded-xs bg-on-tint-blue px-1.5 py-1 align-middle font-mono text-[0.625rem] leading-none font-bold tracking-wider text-tint-blue uppercase">Cambió</span>
    </>
  );
}

/** The numbered section label of the landing ("01 Línea de tiempo"). */
export function SiteSection({ number, children }: { number: string; children: ReactNode }) {
  return (
    <p className="mb-4 flex items-center gap-3 font-mono text-xs font-semibold tracking-widest uppercase">
      <b className="grid h-6 min-w-8.5 place-items-center bg-signal font-semibold text-destructive-foreground">{number}</b>
      {children}
    </p>
  );
}

const TABBABLE = 'button:not(:disabled), input[type="radio"]:checked';
const VERSIONS = [
  { value: "before", label: "Antes" },
  { value: "after", label: "Después" },
] as const;

interface PublishPreviewProps<V> {
  /** The stored row, or null when the item is not on the site yet. */
  before: V | null;
  /** The form as it is now. */
  after: V;
  fields: readonly PublishField<V>[];
  /** The item as the landing shows it; `changed` holds the names of the fields to highlight. */
  render: (values: V, changed: ReadonlySet<string>, before: V | null) => ReactNode;
  sending: boolean;
  returnTo: HTMLElement | null;
  onKeepEditing: () => void;
  onConfirm: () => void;
}

/**
 * Full-screen dialog with how the item looks on the landing, before and after this save. It traps the
 * focus, closes with Escape and gives the focus back to the button that opened it. The bottom bar stays in
 * reach on a phone. It sits in `body` so no ancestor's containment or stacking can cut it short.
 */
export function PublishPreview<V extends { [K in keyof V]: string | boolean }>({ before, after, fields, render, sending, returnTo, onKeepEditing, onConfirm }: PublishPreviewProps<V>) {
  const titleId = useId();
  const changesId = useId();
  const root = useRef<HTMLDivElement>(null);
  const [shown, setShown] = useState<"before" | "after">("after");
  const [opener] = useState(returnTo);
  const changes = before ? diffFields(before, after, fields) : [];
  const changed = new Set(shown === "after" ? changes.map((change) => change.name) : []);
  const status = before === null ? "Nuevo en el sitio" : changes.length === 0 ? "Sin cambios" : `${changes.length} ${changes.length === 1 ? "cambio" : "cambios"}`;

  useEffect(() => {
    const overflow = document.body.style.overflow;

    root.current?.focus();
    document.body.style.overflow = "hidden";

    return () => {
      document.body.style.overflow = overflow;
      opener?.focus();
    };
  }, [opener]);

  function handleKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    if (event.key === "Escape") {
      event.preventDefault();
      if (!sending) onKeepEditing();

      return;
    }
    if (event.key !== "Tab") return;

    const items = Array.from(root.current?.querySelectorAll<HTMLElement>(TABBABLE) ?? []);
    const active = document.activeElement;

    if (event.shiftKey && (active === items[0] || active === root.current)) {
      event.preventDefault();
      items.at(-1)?.focus();
    } else if (!event.shiftKey && active === items.at(-1)) {
      event.preventDefault();
      items[0]?.focus();
    }
  }

  return createPortal(
    <div ref={root} role="dialog" aria-modal="true" aria-labelledby={titleId} tabIndex={-1} onKeyDown={handleKeyDown} className="fixed inset-0 z-50 flex flex-col bg-muted outline-none">
      <header className="flex flex-wrap items-center justify-between gap-x-6 gap-y-2 border-b-[3px] border-foreground bg-card px-4 py-3 md:px-8">
        <h2 id={titleId} className="font-display text-2xl leading-none md:text-3xl">
          Así queda
        </h2>
        <Segmented legend="Versión del sitio" name="preview-version" value={shown} options={VERSIONS} onChange={(value) => setShown(value as "before" | "after")} columnsClassName="grid-cols-2" className="w-full md:w-72" />
      </header>
      <div className="min-h-0 flex-1 overflow-y-auto p-4 md:p-8">
        <div className="mx-auto grid max-w-4xl gap-6">
          <p role="status" className="sr-only">
            {shown === "after" ? "Mostrando Después: así queda el sitio." : "Mostrando Antes: así está el sitio ahora."}
          </p>
          <div data-slot="publish-site" className="overflow-hidden rounded bg-card shadow-[0_0_0_1.5px_var(--color-paper-ring)]">
            <div className="bg-deep px-4 py-2.5 font-mono text-xs text-white">Sitio público</div>
            <div className="p-4 md:p-8">
              {shown === "before" && before === null ? (
                <p className="rounded border-2 border-dashed border-dash p-8 text-center text-mist">Todavía no está en el sitio. Al publicar, aparecerá así: pase a «Después».</p>
              ) : (
                render(shown === "before" ? before! : after, changed, before)
              )}
            </div>
          </div>
          {before !== null && changes.length > 0 ? (
            <section data-slot="publish-changes" aria-labelledby={changesId} className="grid gap-2">
              <h3 id={changesId} className="text-sm font-[650]">
                Qué cambia
              </h3>
              <ul className="grid gap-1.5 text-sm">
                {changes.map((change) => (
                  <li key={change.name} className="rounded-sm bg-tint-blue px-3 py-2 text-on-tint-blue">
                    {changeText(change)}
                  </li>
                ))}
              </ul>
            </section>
          ) : null}
        </div>
      </div>
      <div className="grid gap-3 border-t-[3px] border-foreground bg-card px-4 pt-3 pb-[calc(0.75rem+env(safe-area-inset-bottom))] md:flex md:items-center md:px-8">
        <p className="font-semibold">{status}</p>
        <div className="grid grid-cols-2 gap-2.5 md:ml-auto md:flex">
          <Button variant="line" aria-disabled={sending || undefined} onClick={() => (sending ? undefined : onKeepEditing())}>
            Seguir editando
          </Button>
          <Button busy={sending} aria-disabled={sending || undefined} onClick={() => (sending ? undefined : onConfirm())}>
            Sí, publicar
          </Button>
        </div>
      </div>
    </div>,
    document.body,
  );
}
