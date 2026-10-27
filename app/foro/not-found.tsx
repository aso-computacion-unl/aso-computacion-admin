import Link from "next/link";

import { Button } from "@/components/ui/button";

// An unknown category, a missing thread and a thread the moderation hid look the same on purpose, so the copy names no kind of page.
// Event routes have their own (eventos/[slug]/not-found.tsx).
export default function ForumNotFound() {
  return (
    <div className="mx-auto mt-8 grid max-w-xl justify-items-start gap-4 border-l-2 border-dashed border-sky pl-5">
      <h1 className="font-display text-[2rem] leading-[1.1]">No encontrado</h1>
      <p className="text-mist">Esta página del foro no existe, ya no está disponible o la dirección cambió.</p>
      <Button asChild variant="line">
        <Link href="/foro">Volver al foro</Link>
      </Button>
    </div>
  );
}
