import { useId, type FormEvent, type PropsWithChildren, type ReactNode, type RefObject } from "react";

import { cn } from "@/lib/utils";

import { Panel } from "./form-layout";
import { ActionBar } from "./form-parts";

/**
 * Spans of an editor group's 12-column grid by kind of data: a short text 6, a long text the full row. The grid
 * starts once the group is 36rem wide, so a one-column editor (41.5rem frame) also gets its 6 + 6 rows.
 */
export const SPAN = { text: "@xl:col-span-6", row: "@xl:col-span-12" } as const;

/** One group of an editor: an 18px heading with its purpose on the same line, then its fields on the 12-column grid. */
export function EditorGroup({ title, purpose, children }: { title: string; purpose?: string; children: ReactNode }) {
  const id = useId();

  return (
    <section aria-labelledby={id} className="min-w-0">
      <div className="mb-4 flex flex-wrap items-baseline gap-x-3 gap-y-1">
        <h2 id={id} className="text-lg leading-[1.3] font-bold font-stretch-semi-expanded">
          {title}
        </h2>
        {purpose ? <span className="text-[0.8125rem] text-mist">{purpose}</span> : null}
      </div>
      <div className="grid gap-4 @xl:grid-cols-12">{children}</div>
    </section>
  );
}

/**
 * The compact card of the publish panel: the item as its site section lists it, updated while it is typed. Its name
 * must not carry the text of a field's label, so `getByLabel` and voice control keep one control per label.
 */
export function CardPreview({ label, section, children }: { label: string; section: string; children: ReactNode }) {
  return (
    <div role="group" aria-label={label} className="grid gap-1 rounded border border-border bg-muted px-3.5 py-3">
      <span className="font-mono text-[0.8125rem] tracking-[0.04em] text-sky uppercase">{section}</span>
      {children}
    </div>
  );
}

interface EditorSplitProps {
  formRef: RefObject<HTMLFormElement | null>;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
  /** The content zone: what the public reads, in groups, and the editor's «Más opciones». */
  children: ReactNode;
  /** The compact card of how the item will look on the site. */
  preview: ReactNode;
  /** The publish switch(es): in the panel on lg+, a compact row under the page title on a phone. */
  state: ReactNode;
  /** «Programar publicación y retiro», when the item has a publish window. */
  schedule?: ReactNode;
  /** A short note at the foot of the panel (what comes after creating it). */
  note?: ReactNode;
  /** The save feedback of the action bar. */
  status: ReactNode;
  /** The one primary button. */
  submit: ReactNode;
  /** The publish preview dialog, while it is open. */
  dialog?: ReactNode;
}

/**
 * The two zones of an editor with a publish state: what the public reads on the left, and in a 22rem panel on the
 * right that stays in view, what decides the publication (preview, state, schedule and the one primary button). On a
 * phone every side wrapper dissolves (`contents`): the state row moves up under the page title, the rest is a card
 * after the content, and the save bar sticks along the whole form. One control per field, only its place changes.
 *
 * The side column never grows past the screen: a taller one (an open schedule on a short screen) scrolls by itself, and
 * the save bar, sticky at its foot, stays in view. On a phone the `order`s keep state, content, the page's blocks
 * (`EditorColumns`), the panel, then the save bar.
 */
export function EditorSplit({ formRef, onSubmit, children, preview, state, schedule, note, status, submit, dialog }: EditorSplitProps) {
  const headingId = useId();
  // On a phone the state row leaves the card: a rule with nothing after it would close the card.
  const afterRule = Boolean(schedule || note);

  return (
    <form ref={formRef} onSubmit={onSubmit} noValidate className="grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_22rem]">
      <Panel className="grid gap-10">{children}</Panel>

      <div data-slot="publish-side" className="contents lg:sticky lg:top-22 lg:block lg:max-h-[calc(100dvh-7.5rem)] lg:overflow-y-auto">
        <div className="contents @container lg:grid lg:gap-4 lg:rounded-t lg:bg-card lg:p-5">
          <section aria-labelledby={headingId} className="@container grid gap-4 rounded bg-card p-4 max-lg:order-2 md:p-5 lg:contents">
            <h2 id={headingId} className="text-lg leading-[1.3] font-bold font-stretch-semi-expanded lg:order-1">
              Publicación
            </h2>
            <div className="min-w-0 lg:order-1">{preview}</div>
            <hr className={cn("border-0 border-t border-border lg:order-1", !afterRule && "hidden lg:block")} />
            {schedule ? <div className="min-w-0 lg:order-3">{schedule}</div> : null}
            {note ? <p className="text-[0.8125rem] text-mist lg:order-3">{note}</p> : null}
          </section>
          {/* Two switches share the row from sm up to lg, where the panel stacks them. */}
          <div
            data-slot="publish-state"
            className="order-first grid rounded bg-card px-4 py-1 sm:auto-cols-fr sm:grid-flow-col sm:gap-x-4 md:px-5 lg:order-2 lg:grid-flow-row lg:rounded-none lg:bg-transparent lg:p-0"
          >
            {state}
          </div>
        </div>
        <ActionBar className="mx-0 mt-0 rounded max-lg:order-4 md:mx-0 lg:mb-0 lg:grid-cols-1 lg:gap-3 lg:rounded-t-none" status={status}>
          {submit}
        </ActionBar>
      </div>
      {dialog}
    </form>
  );
}

/**
 * Page-owned columns for an edit page whose content column also holds blocks with forms of their own (the event's
 * Fotos, the news cover): forms never nest, so they go here, beside the editor's form and not inside it. The form
 * dissolves (`contents`) into this grid; the side column spans both rows so it sticks along the whole page, and on a
 * phone these blocks follow the content (order 1), before the publish panel and the save bar.
 */
export function EditorColumns({ id, content, children }: PropsWithChildren<{ id?: string; content: ReactNode }>) {
  return (
    <div id={id} className="grid scroll-mt-18 items-start gap-6 lg:grid-cols-[minmax(0,1fr)_22rem] [&>form]:contents lg:[&_[data-slot=publish-side]]:row-span-2">
      {children}
      <div className="grid min-w-0 gap-6 max-lg:order-1">{content}</div>
    </div>
  );
}
