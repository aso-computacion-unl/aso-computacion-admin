"use client";

import Link from "next/link";
import { useEffect, useId, useRef, useState } from "react";

import { Icon } from "@/components/icons";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface NewThreadMenuProps {
  categories: { slug: string; name: string }[];
  /** The category the list is narrowed to: the thread goes there with no question asked. */
  currentSlug?: string;
  variant?: "primary" | "line";
  /** Where the panel opens relative to the button. */
  align?: "end" | "center";
}

const newThreadHref = (slug: string) => `/foro/c/${slug}/nuevo`;

/**
 * "Nuevo hilo" for a page that lists several categories: the thread needs one, so the button opens a choice
 * of them, each a link to the new-thread page of that category. With one category, or a list narrowed to one,
 * it is a plain link. The panel is always in the markup, hidden while closed (out of the tab order and the
 * accessibility tree); Escape, a click outside or tabbing away closes it.
 */
export function NewThreadMenu({ categories, currentSlug, variant = "primary", align = "end" }: NewThreadMenuProps) {
  const direct = currentSlug ?? (categories.length === 1 ? categories[0]?.slug : undefined);

  if (direct) {
    return (
      <Button asChild variant={variant}>
        <Link href={newThreadHref(direct)}>
          <Icon name="plus" />
          Nuevo hilo
        </Link>
      </Button>
    );
  }

  return <CategoryChoice categories={categories} variant={variant} align={align} />;
}

function CategoryChoice({ categories, variant, align }: Required<Pick<NewThreadMenuProps, "variant" | "align">> & Pick<NewThreadMenuProps, "categories">) {
  const [open, setOpen] = useState(false);
  const root = useRef<HTMLDivElement>(null);
  const trigger = useRef<HTMLButtonElement>(null);
  const panel = useRef<HTMLDivElement>(null);
  const panelId = useId();

  useEffect(() => {
    if (!open) return;

    panel.current?.querySelector<HTMLElement>("a[href]")?.focus();

    const closeOutside = (event: Event) => {
      if (!root.current?.contains(event.target as Node | null)) setOpen(false);
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      setOpen(false);
      trigger.current?.focus();
    };

    document.addEventListener("keydown", onKeyDown);
    document.addEventListener("pointerdown", closeOutside);
    document.addEventListener("focusin", closeOutside);

    return () => {
      document.removeEventListener("keydown", onKeyDown);
      document.removeEventListener("pointerdown", closeOutside);
      document.removeEventListener("focusin", closeOutside);
    };
  }, [open]);

  return (
    <div ref={root} className="relative">
      <Button ref={trigger} variant={variant} aria-haspopup="true" aria-expanded={open} aria-controls={panelId} onClick={() => setOpen((current) => !current)}>
        <Icon name="plus" />
        Nuevo hilo
        <Icon name="chev" className={cn("size-4! transition-transform duration-150", open && "rotate-180")} />
      </Button>
      <div
        ref={panel}
        id={panelId}
        hidden={!open}
        className={cn(
          "absolute top-full z-20 mt-1.5 w-60 max-w-[calc(100vw-2rem)] rounded-xl border border-border bg-muted p-1.5 text-left shadow-[0_12px_28px_-14px_rgb(0_0_0/0.55)]",
          align === "end" ? "right-0" : "left-1/2 -translate-x-1/2",
        )}
      >
        <p className="px-3 pt-1.5 pb-1 text-xs font-semibold text-mist">Publicar en</p>
        {categories.map((category) => (
          <Link key={category.slug} href={newThreadHref(category.slug)} className="flex min-h-11 items-center rounded-lg px-3 font-semibold wrap-anywhere text-foreground transition-colors hover:bg-card focus-visible:-outline-offset-2">
            {category.name}
          </Link>
        ))}
      </div>
    </div>
  );
}
