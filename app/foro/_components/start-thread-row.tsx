import { NewThreadMenu } from "./new-thread-menu";

interface StartThreadRowProps {
  categories: { slug: string; name: string }[];
  /** The category the list is narrowed to: the thread goes there with no question asked. */
  currentSlug?: string;
}

/** The last row of a thread list: the way to add one more. Outside the list's card so the category panel is not clipped by it. */
export function StartThreadRow({ categories, currentSlug }: StartThreadRowProps) {
  return (
    <div className="mt-3 flex flex-wrap items-center justify-between gap-x-6 gap-y-3 rounded-xl border border-dashed border-border px-4 py-4 sm:px-5">
      <div className="min-w-0">
        <p className="font-semibold text-foreground">¿No encuentra su duda?</p>
        <p className="text-sm text-mist">Abra un hilo y otros estudiantes le responderán.</p>
      </div>
      <NewThreadMenu categories={categories} currentSlug={currentSlug} variant="line" />
    </div>
  );
}
