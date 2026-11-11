import { Icon } from "@/components/icons";
import { cn } from "@/lib/utils";

/**
 * What the lane shows where the moderation hid a reply: the same node and card, with one line and no text, author,
 * time, reactions or actions. It takes nothing but the anchor and whether it holds the thread's best-answer slot, so
 * nothing of the reply can reach the browser through it.
 */
export function HiddenPostCard({ id, best = false }: { id: string; best?: boolean }) {
  return (
    <li>
      <span aria-hidden="true" className="z-1 grid size-7 place-items-center justify-self-center rounded-full bg-card text-mist shadow-[0_0_0_4px_var(--color-navy)] sm:size-8">
        <Icon name="lock" className="size-3.5" />
      </span>
      <article id={id} className={cn("min-w-0 scroll-mt-20 rounded-xl border border-dashed bg-muted px-3 py-3.5 text-mist sm:px-4", best ? "border-sky" : "border-border")}>
        <p>Respuesta oculta por la moderación</p>
      </article>
    </li>
  );
}
