import Link from "next/link";

import { Button } from "@/components/ui/button";

// Only events that ask for a UNL account have a page here: one that registers on the landing, or that does not exist, ends up on this 404.
export default function EventNotFound() {
  return (
    <div className="mx-auto mt-8 grid max-w-xl justify-items-start gap-4 border-l-2 border-dashed border-sky pl-5">
      <h1 className="font-display text-[2rem] leading-[1.1]">No encontrado</h1>
      <p className="text-mist">Este evento no tiene una página de inscripción en el foro: puede que se inscriba en otro lugar, que todavía no esté publicado o que la dirección haya cambiado.</p>
      <Button asChild variant="line">
        <Link href="/foro">Volver al foro</Link>
      </Button>
    </div>
  );
}
