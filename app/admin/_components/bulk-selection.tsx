"use client";

import { createContext, useContext, useEffect, useMemo, useRef, useState, useTransition, type ReactNode } from "react";

import { Button } from "@/components/ui/button";
import { bulkSetPublished, bulkTrash } from "@/interface/admin/bulk/actions";
import type { BulkKind, BulkResult } from "@/interface/admin/bulk/bulk-input";
import { doneMessage, OPERATIONS, selectAll, settle, toggle, type BulkOperation } from "@/interface/admin/bulk/bulk-selection";
import { pluralize } from "@/interface/admin/publication-summary";

import { useToast } from "./toast";

const UNEXPECTED_ERROR = "Ocurrió un error inesperado. Intente nuevamente.";

interface SelectionApi {
  selected: ReadonlySet<string>;
  toggle: (id: string) => void;
  disabled: boolean;
}

const SelectionContext = createContext<SelectionApi | null>(null);

/** The checkbox of one row. Outside a `BulkSelection` it renders nothing, so a row works with or without bulk actions. */
export function BulkCheckbox({ id, label }: { id: string; label: string }) {
  const selection = useContext(SelectionContext);

  if (!selection) return null;

  return (
    <label className="inline-flex size-11 shrink-0 cursor-pointer items-center justify-center">
      <input
        type="checkbox"
        checked={selection.selected.has(id)}
        disabled={selection.disabled}
        onChange={() => selection.toggle(id)}
        aria-label={`Seleccionar: ${label}`}
        className="size-5 cursor-pointer accent-action"
      />
    </label>
  );
}

interface BulkSelectionProps {
  kind: BulkKind;
  /** The rows on the page, in order: the "select all" of the bar covers exactly these. */
  items: readonly { id: string; label: string }[];
  /** False on a short list: no select-all bar and no row checkboxes, only the rows. */
  enabled?: boolean;
  children?: ReactNode;
}

const OPERATION_VARIANT = { publish: "line", unpublish: "line", trash: "quiet" } as const;

/**
 * Row selection for a list and the bar that acts on it. The bar exists only while something is
 * selected, and sits after the rows, stuck to the bottom of the screen: showing it never moves
 * the rows, and it stays in reach however far down the list is. Publishing, unpublishing and
 * trashing all ask for a confirmation; the server reports a result per item, and what failed
 * stays selected with its reason so it can be retried.
 */
export function BulkSelection({ kind, items, enabled = true, children }: BulkSelectionProps) {
  const [selected, setSelected] = useState<ReadonlySet<string>>(new Set());
  const [confirming, setConfirming] = useState<BulkOperation | null>(null);
  const [problem, setProblem] = useState<string | null>(null);
  const [failures, setFailures] = useState<{ id: string; error: string }[]>([]);
  const [pending, startTransition] = useTransition();
  const { notify } = useToast();
  const master = useRef<HTMLInputElement>(null);
  const labels = useMemo(() => new Map(items.map((item) => [item.id, item.label])), [items]);
  const ids = useMemo(() => items.map((item) => item.id), [items]);

  // A row that left the page (trashed, or a new page) can no longer be acted on.
  useEffect(() => {
    // Pruning state when the rows change is the point here, and the updater bails out unchanged.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setSelected((previous) => {
      const kept = [...previous].filter((id) => labels.has(id));

      return kept.length === previous.size ? previous : new Set(kept);
    });
  }, [labels]);

  const allSelected = ids.length > 0 && ids.every((id) => selected.has(id));

  useEffect(() => {
    if (master.current) master.current.indeterminate = selected.size > 0 && !allSelected;
  }, [selected, allSelected]);

  function run(operation: BulkOperation) {
    const chosen = [...selected];

    setProblem(null);
    setFailures([]);
    startTransition(async () => {
      let result: BulkResult;

      try {
        result = operation === "trash" ? await bulkTrash(kind, chosen) : await bulkSetPublished(kind, chosen, operation === "publish");
      } catch {
        result = { error: UNEXPECTED_ERROR };
      }

      setConfirming(null);

      if (result.error !== undefined) {
        setProblem(result.error);
        return;
      }

      const outcome = settle(selected, result.results);

      setSelected(outcome.remaining);
      setFailures(outcome.failures);
      if (outcome.okCount > 0) notify(doneMessage(operation, outcome.okCount));
    });
  }

  const api = useMemo<SelectionApi>(
    () => ({ selected, toggle: (id) => setSelected((previous) => toggle(previous, id)), disabled: pending }),
    [selected, pending],
  );

  if (items.length === 0 || !enabled) return <>{children}</>;

  // A failed run keeps its reason on screen even if the rows it names have left the page.
  const showBar = selected.size > 0 || confirming !== null || problem !== null || failures.length > 0;

  return (
    <SelectionContext.Provider value={api}>
      {children}
      {showBar ? (
        <section
          aria-label="Acciones en lote"
          className="sticky bottom-[calc(4.25rem+env(safe-area-inset-bottom))] z-5 mt-5 grid gap-3 rounded bg-card p-3 shadow-[0_-1px_0_var(--color-border)] md:px-4 lg:bottom-3"
        >
          <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
            <label className="inline-flex min-h-11 cursor-pointer items-center gap-3 text-sm font-semibold">
              <input
                ref={master}
                type="checkbox"
                checked={allSelected}
                disabled={pending}
                onChange={() => setSelected(selectAll(ids, !allSelected))}
                className="size-5 cursor-pointer accent-action"
              />
              Seleccionar todo en esta página
            </label>
            <p role="status" className="font-mono text-[0.8125rem] text-mist">
              {pluralize(selected.size, "seleccionado", "seleccionados")}
            </p>
            {selected.size > 0 && confirming === null ? (
              <div className="flex flex-wrap items-center gap-2">
                {(Object.keys(OPERATIONS) as BulkOperation[]).map((operation) => (
                  <Button key={operation} variant={OPERATION_VARIANT[operation]} size="sm" onClick={() => setConfirming(operation)}>
                    {OPERATIONS[operation].label}
                  </Button>
                ))}
                <Button variant="quiet" size="sm" onClick={() => setSelected(new Set())}>
                  Limpiar selección
                </Button>
              </div>
            ) : null}
          </div>

          {confirming !== null ? (
            <div role="group" aria-label={`Confirmar: ${OPERATIONS[confirming].label.toLowerCase()}`} className="grid gap-3 rounded bg-muted p-3 text-sm">
              <p>{OPERATIONS[confirming].confirm(selected.size)}</p>
              <div className="flex flex-wrap gap-2">
                <Button variant={confirming === "trash" ? "danger" : "primary"} size="sm" busy={pending} aria-disabled={pending || undefined} onClick={() => !pending && run(confirming)}>
                  {OPERATIONS[confirming].confirmLabel}
                </Button>
                <Button variant="line" size="sm" aria-disabled={pending || undefined} onClick={() => !pending && setConfirming(null)} autoFocus>
                  No, conservar
                </Button>
              </div>
            </div>
          ) : null}

          {problem ? (
            <p role="alert" className="text-sm font-semibold text-error">
              {problem}
            </p>
          ) : null}
          {failures.length > 0 ? (
            <div role="alert" className="grid gap-1.5 text-sm">
              <p className="font-semibold text-error">
                {failures.length === 1 ? "1 elemento no se pudo procesar; sigue seleccionado:" : `${failures.length} elementos no se pudieron procesar; siguen seleccionados:`}
              </p>
              <ul className="grid gap-1 pl-4">
                {failures.map((failure) => (
                  <li key={failure.id} className="list-disc wrap-anywhere">
                    «{labels.get(failure.id) ?? failure.id}»: {failure.error}
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
        </section>
      ) : null}
    </SelectionContext.Provider>
  );
}
