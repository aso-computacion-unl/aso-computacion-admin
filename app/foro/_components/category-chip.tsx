import { categoryHue } from "@/interface/forum/forum-display";

/** The category label of a thread row: a hue per category, always with the name as text, never colour alone. */
export function CategoryChip({ category }: { category: { slug: string; name: string } }) {
  return (
    <span className="chip" data-hue={categoryHue(category.slug)}>
      {category.name}
    </span>
  );
}
