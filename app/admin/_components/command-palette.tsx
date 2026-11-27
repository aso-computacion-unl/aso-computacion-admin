"use client";

import { useRouter } from "next/navigation";
import { useEffect, useEffectEvent, useId, useRef, useState, type KeyboardEvent, type ReactNode, type RefObject } from "react";
import { createPortal } from "react-dom";

import { Icon, type IconName } from "@/components/icons";
import type { Role } from "@/domain/user";
import { cn } from "@/lib/utils";

import { AJUSTES_TABS, AREA_NAV, HOME_NAV, MODULE_NAV, visibleTo } from "./nav-items";
import { GuardedLink } from "./unsaved-changes";
import { useHasUnsavedChanges } from "./use-controlled-form";

export interface PaletteAction {
  id: string;
  label: string;
  href: string;
  group: "Crear" | "Ir a";
  icon: IconName;
  /** The single key that creates it from anywhere in the admin. */
  shortcut?: "E" | "N" | "P";
  /** Other words it answers to. */
  keywords?: string;
}

/** What the board creates, most used first; the first three also have a single-key shortcut. */
export const CREATE_ACTIONS: readonly PaletteAction[] = [
  { id: "new-event", label: "Nuevo evento", href: "/admin/events/new", group: "Crear", icon: "events", shortcut: "E", keywords: "crear evento" },
  { id: "new-news", label: "Nueva novedad", href: "/admin/news/new", group: "Crear", icon: "news", shortcut: "N", keywords: "crear noticia" },
  { id: "new-faq", label: "Nueva pregunta", href: "/admin/faqs/new", group: "Crear", icon: "faq", shortcut: "P", keywords: "crear faq pregunta frecuente" },
  { id: "new-board", label: "Agregar integrante de la directiva", href: "/admin/board/new", group: "Crear", icon: "board", keywords: "crear directiva miembro" },
  { id: "new-pillar", label: "Nuevo pilar", href: "/admin/pillars/new", group: "Crear", icon: "pillars", keywords: "crear" },
  { id: "new-command", label: "Nuevo comando", href: "/admin/commands/new", group: "Crear", icon: "merge", keywords: "crear" },
  { id: "new-sponsor", label: "Nuevo aliado", href: "/admin/sponsors/new", group: "Crear", icon: "star", keywords: "crear sponsor patrocinador" },
  { id: "new-social", label: "Agregar red", href: "/admin/socials/new", group: "Crear", icon: "share", keywords: "crear red social" },
];

const SHORTCUTS: Readonly<Record<string, string>> = Object.fromEntries(CREATE_ACTIONS.flatMap((action) => (action.shortcut ? [[action.shortcut, action.href]] : [])));

/** Every action the role may take from the palette: create, review the forum, and go to each admin page (from the nav, so nothing drifts). */
export function paletteActions(role: Role): PaletteAction[] {
  const go = (item: { href: string; label: string; icon?: IconName }, keywords?: string): PaletteAction => ({
    id: `go-${item.href}`,
    label: item.label,
    href: item.href,
    group: "Ir a",
    icon: item.icon ?? "right",
    keywords,
  });
  const pages = [
    go(HOME_NAV, "panel"),
    ...visibleTo(MODULE_NAV, role).map((item) => go(item, "landing contenido")),
    ...AREA_NAV.filter((item) => item.label !== "Landing").map((item) => go(item)),
    ...visibleTo(AJUSTES_TABS, role).map((item) => go(item, "ajustes")),
  ];
  const seen = new Set<string>();
  const unique = pages.filter((action) => (seen.has(action.href) ? false : (seen.add(action.href), true)));

  return [...CREATE_ACTIONS, { id: "review-forum", label: "Revisar el foro", href: "/admin/foro/reportes", group: "Ir a", icon: "msg", keywords: "reportes moderar" }, ...unique.filter((action) => action.href !== "/admin/foro/reportes")];
}

/** Lower case without accents, so «noticia» finds «Noticia» and «pagina» finds «Página». */
const fold = (text: string) => text.normalize("NFD").replace(/\p{Diacritic}/gu, "").toLowerCase();

/** How well one action answers the query, lower is better; null when it does not answer. */
function rank(action: PaletteAction, tokens: readonly string[], whole: string): number | null {
  const label = fold(action.label);
  const words = label.split(/\s+/);
  const haystack = `${label} ${fold(action.group)} ${fold(action.keywords ?? "")}`;

  if (!tokens.every((token) => haystack.includes(token))) return null;
  if (label.startsWith(whole)) return 0;
  if (tokens.every((token) => words.some((word) => word.startsWith(token)))) return 1;
  if (tokens.every((token) => label.includes(token))) return 2;

  return 3;
}

/** The actions that answer the query, best first and in their own order on a tie; all of them for an empty query. */
export function filterActions(actions: readonly PaletteAction[], query: string): PaletteAction[] {
  const whole = fold(query).trim().replace(/\s+/g, " ");

  if (whole === "") return [...actions];

  const tokens = whole.split(" ");

  return actions
    .map((action, index) => ({ action, index, score: rank(action, tokens, whole) }))
    .filter((entry): entry is { action: PaletteAction; index: number; score: number } => entry.score !== null)
    .sort((a, b) => a.score - b.score || a.index - b.index)
    .map((entry) => entry.action);
}

const TYPING_TARGET = 'input, textarea, select, [contenteditable]:not([contenteditable="false"])';

/** True when a key pressed here is text being written (a field, a select, an editable region), not a command. */
export function isTypingTarget(target: EventTarget | null): boolean {
  if (typeof Element === "undefined" || !(target instanceof Element)) return false;

  return target.closest(TYPING_TARGET) !== null || (target instanceof HTMLElement && target.isContentEditable === true);
}

interface KeyLike {
  key: string;
  ctrlKey: boolean;
  metaKey: boolean;
  altKey: boolean;
  shiftKey: boolean;
  repeat?: boolean;
  isComposing?: boolean;
}

/** Ctrl K, or ⌘ K on a Mac: the palette's own chord, which works even from a field. */
export function isPaletteChord(event: KeyLike): boolean {
  return (event.ctrlKey || event.metaKey) && !event.altKey && !event.shiftKey && event.key.toLowerCase() === "k";
}

/**
 * Where a single-key shortcut (E, N, P) goes, or null when the key must stay a key: while typing, with any
 * modifier held, while a dialog is open, on a held-down repeat, or mid-composition (an accent being typed).
 */
export function shortcutTarget(event: KeyLike, context: { typing: boolean; dialogOpen: boolean }): string | null {
  if (context.typing || context.dialogOpen) return null;
  if (event.ctrlKey || event.metaKey || event.altKey || event.shiftKey || event.repeat || event.isComposing) return null;

  return SHORTCUTS[event.key.toUpperCase()] ?? null;
}

/** A modal of the admin is open (the palette itself, the leave question, a preview, a confirm): keys belong to it. */
function dialogIsOpen(): boolean {
  return document.querySelector('[aria-modal="true"], [role="alertdialog"], dialog[open]') !== null;
}

const OPEN_EVENT = "admin:command-palette";

/** Opens the palette from anywhere in the admin (the layout mounts it once and it listens for this). */
export function openCommandPalette() {
  window.dispatchEvent(new Event(OPEN_EVENT));
}

/** The `$ aso buscar o crear…` line: a button that opens the palette, as Ctrl K does. */
export function PaletteButton({ className, children }: { className?: string; children: ReactNode }) {
  return (
    <button type="button" aria-haspopup="dialog" aria-keyshortcuts="Control+K Meta+K" onClick={openCommandPalette} className={className}>
      {children}
    </button>
  );
}

/** The tiles of the three single-key creates (Acciones rápidas), from the same list the shortcuts read: each `<li>` goes in the caller's list. */
export function CreateTiles({ tileClassName, iconClassName }: { tileClassName: string; iconClassName: string }) {
  return CREATE_ACTIONS.filter((action) => action.shortcut).map((action) => (
    <li key={action.id}>
      <GuardedLink href={action.href} aria-keyshortcuts={action.shortcut} className={tileClassName}>
        <span aria-hidden="true" className={iconClassName}>
          <Icon name={action.icon} className="size-5" />
        </span>
        <b className="text-[0.9375rem] leading-tight">{action.label}</b>
        <kbd aria-hidden="true" className="absolute top-3.5 right-3.5 grid h-5.5 min-w-5.5 place-items-center rounded-[6px] bg-foreground/10 px-1.5 font-mono text-xs font-semibold">
          {action.shortcut}
        </kbd>
      </GuardedLink>
    </li>
  ));
}

/**
 * The admin's command palette: Ctrl K / ⌘ K (or `PaletteButton`) opens it, a filter narrows the actions, arrows
 * move, Enter goes and Escape closes, giving the focus back to what opened it. It also owns the single-key
 * shortcuts E, N and P, which go to the create pages when nobody is typing. Renders nothing until opened.
 */
export function CommandPalette({ role }: { role: Role }) {
  const [open, setOpen] = useState(false);
  const opener = useRef<HTMLElement | null>(null);
  const router = useRouter();
  const unsaved = useHasUnsavedChanges();

  const show = useEffectEvent(() => {
    if (open) return;
    opener.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    setOpen(true);
  });

  const onKeyDown = useEffectEvent((event: globalThis.KeyboardEvent) => {
    if (event.defaultPrevented) return;
    if (isPaletteChord(event)) {
      event.preventDefault();
      if (open || !dialogIsOpen()) show();

      return;
    }

    const href = shortcutTarget(event, { typing: isTypingTarget(event.target), dialogOpen: open || dialogIsOpen() });

    // With changes not saved yet, a stray key never takes the page away: the palette's links ask first instead.
    if (href === null || unsaved) return;
    event.preventDefault();
    router.push(href);
  });

  useEffect(() => {
    const keyListener = (event: globalThis.KeyboardEvent) => onKeyDown(event);
    const openListener = () => show();

    document.addEventListener("keydown", keyListener);
    window.addEventListener(OPEN_EVENT, openListener);

    return () => {
      document.removeEventListener("keydown", keyListener);
      window.removeEventListener(OPEN_EVENT, openListener);
    };
  }, []);

  if (!open) return null;

  return (
    <PaletteDialog
      actions={paletteActions(role)}
      opener={opener}
      onClose={(restoreFocus) => {
        setOpen(false);
        if (restoreFocus) opener.current?.focus();
      }}
    />
  );
}

interface PaletteDialogProps {
  actions: readonly PaletteAction[];
  opener: RefObject<HTMLElement | null>;
  /** `restoreFocus` is false when an action was chosen: the page is about to change (or the leave question takes the focus). */
  onClose: (restoreFocus: boolean) => void;
}

function PaletteDialog({ actions, opener, onClose }: PaletteDialogProps) {
  const [query, setQuery] = useState("");
  const [active, setActive] = useState(0);
  const input = useRef<HTMLInputElement>(null);
  const list = useRef<HTMLDivElement>(null);
  const titleId = useId();
  const listId = useId();
  const optionId = (index: number) => `${listId}-option-${index}`;
  const shown = filterActions(actions, query);
  const current = Math.min(active, Math.max(0, shown.length - 1));

  useEffect(() => {
    input.current?.focus();
  }, []);

  useEffect(() => {
    document.getElementById(optionId(current))?.scrollIntoView({ block: "nearest" });
  });

  function handleKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    if (event.key === "Escape") {
      event.preventDefault();
      onClose(true);
    } else if (event.key === "ArrowDown" || event.key === "ArrowUp") {
      event.preventDefault();
      if (shown.length > 0) setActive((current + (event.key === "ArrowDown" ? 1 : -1) + shown.length) % shown.length);
    } else if (event.key === "Enter") {
      event.preventDefault();
      // The option is a guarded link: clicking it goes, or asks first when a form holds unsaved changes.
      list.current?.querySelector<HTMLAnchorElement>(`#${CSS.escape(optionId(current))}`)?.click();
    } else if (event.key === "Tab") {
      // The filter is the one stop of the dialog: the options are reached with the arrows.
      event.preventDefault();
      input.current?.focus();
    }
  }

  return createPortal(
    <div
      data-area="admin"
      className="fixed inset-0 z-100 grid items-start justify-items-center bg-scrim p-4 pt-[12vh]"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose(true);
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        onKeyDown={handleKeyDown}
        className="grid w-full max-w-xl gap-3 rounded-card bg-card p-3 text-foreground ring-1 ring-paper-ring ring-inset"
      >
        <h2 id={titleId} className="sr-only">
          Buscar o crear
        </h2>
        <label className="flex min-h-12 items-center gap-2.5 rounded-control bg-field px-3.5 font-mono text-sm ring-1 ring-input ring-inset focus-within:ring-2 focus-within:ring-sky">
          <span aria-hidden="true" className="text-sky">
            $ aso
          </span>
          <span className="sr-only">Buscar o crear</span>
          <input
            ref={input}
            role="combobox"
            aria-expanded="true"
            aria-controls={listId}
            aria-autocomplete="list"
            aria-activedescendant={shown.length > 0 ? optionId(current) : undefined}
            value={query}
            onChange={(event) => {
              setQuery(event.target.value);
              setActive(0);
            }}
            placeholder="buscar o crear…"
            autoComplete="off"
            spellCheck={false}
            className="min-w-0 flex-1 bg-transparent text-foreground outline-none placeholder:text-mist/80"
          />
          <kbd className="rounded-[6px] bg-foreground/10 px-1.5 py-0.5 text-xs font-semibold">Esc</kbd>
        </label>

        <div ref={list} id={listId} role="listbox" aria-label="Acciones" className="grid max-h-[min(24rem,60vh)] gap-0.5 overflow-y-auto">
          {shown.map((action, index) => (
            <GuardedLink
              key={action.id}
              id={optionId(index)}
              href={action.href}
              role="option"
              aria-selected={index === current}
              tabIndex={-1}
              returnFocusTo={opener}
              aria-keyshortcuts={action.shortcut}
              onMouseMove={() => {
                if (index !== current) setActive(index);
              }}
              onClick={() => onClose(false)}
              className={cn(
                "flex min-h-11 items-center gap-3 rounded-control px-3 py-2 text-[0.9375rem] font-semibold",
                index === current ? "bg-action text-on-action" : "text-foreground",
              )}
            >
              <span aria-hidden="true" className={cn("grid size-8 shrink-0 place-items-center rounded-control", index === current ? "bg-on-action/10" : "bg-tint-navy text-on-tint-navy")}>
                <Icon name={action.icon} className="size-4.5" />
              </span>
              <span className="min-w-0 flex-1 truncate">{action.label}</span>
              <span className={cn("font-mono text-xs", index === current ? "text-on-action/70" : "text-mist")}>{action.group}</span>
              {action.shortcut ? (
                <kbd aria-hidden="true" className={cn("rounded-[6px] px-1.5 py-0.5 font-mono text-xs", index === current ? "bg-on-action/10" : "bg-foreground/10")}>
                  {action.shortcut}
                </kbd>
              ) : null}
            </GuardedLink>
          ))}
        </div>
        {shown.length === 0 ? (
          <p role="status" className="px-3 py-4 text-mist">
            Nada coincide con «{query.trim()}».
          </p>
        ) : null}
      </div>
    </div>,
    document.body,
  );
}
