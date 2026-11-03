interface SectionJumpsProps {
  label: string;
  items: readonly { href: `#${string}`; label: string }[];
}

/**
 * In-page links to the sections of a long edit page, on a phone only: there the side column falls under the
 * form, thousands of pixels down. From lg up the side column sits beside the form and needs no shortcut.
 */
export function SectionJumps({ label, items }: SectionJumpsProps) {
  return (
    <nav aria-label={label} className="-mb-2 flex flex-wrap gap-2 lg:hidden">
      {items.map((item) => (
        <a
          key={item.href}
          href={item.href}
          className="inline-flex min-h-11 items-center rounded bg-card px-4 text-sm font-semibold transition-colors duration-150 ease-out hover:bg-foreground/8 focus-visible:outline-2 focus-visible:outline-sky"
        >
          {item.label}
        </a>
      ))}
    </nav>
  );
}
