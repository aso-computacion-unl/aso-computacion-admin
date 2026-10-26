import Link from "next/link";

import { Button } from "@/components/ui/button";

export default function AdminNotFound() {
  return (
    <div className="mt-8 grid max-w-xl justify-items-start gap-4 border-l-2 border-dashed border-sky pl-5">
      <h1 className="font-display text-[2rem] leading-[1.1]">No encontrado</h1>
      <p className="text-mist">Este elemento no existe o ya fue eliminado.</p>
      <Button asChild variant="line">
        <Link href="/admin">Volver al inicio</Link>
      </Button>
    </div>
  );
}
