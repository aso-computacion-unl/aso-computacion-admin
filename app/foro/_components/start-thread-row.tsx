import { NewThreadMenu } from "./new-thread-menu";

interface StartThreadRowProps {
  categories: { slug: string; name: string }[];
  /** The category the list is narrowed to: the thread goes there with no question asked. */
  currentSlug?: string;
}

/**
 * The end of a thread list, where its branch line stops in an open node: the way to add one more. It lives inside
 * `.thread-graph` (forum.css) and outside the list itself, so the category panel of the button is not clipped.
 */
export function StartThreadRow({ categories, currentSlug }: StartThreadRowProps) {
  return (
    <div className="thread-graph-end flex flex-wrap items-center justify-between gap-x-6 gap-y-3 border-t border-border/50 py-5 pr-(--row-px) pl-[calc(var(--row-px)+2.25rem)] xl:pl-[calc(var(--row-px)+3rem)]">
      <div className="min-w-0">
        <p className="font-semibold text-foreground">¿No encuentra su duda?</p>
        <p className="text-sm text-mist">Abra un hilo y otros estudiantes le responderán.</p>
      </div>
      <NewThreadMenu categories={categories} currentSlug={currentSlug} variant="line" />
    </div>
  );
}
