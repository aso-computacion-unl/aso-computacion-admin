import Link from "next/link";

import { Button } from "@/components/ui/button";

import { BrandLogo } from "./_components/brand-mark";

export default function NotFound() {
  return (
    <main className="grid min-h-screen place-items-center px-6 py-10">
      <div className="grid w-full max-w-sm justify-items-start gap-4">
        <BrandLogo alt="ASO Computación" width={168} className="mb-6 h-auto w-42" />
        <h1 className="font-display text-[1.75rem] leading-[1.15]">Página no encontrada</h1>
        <p className="text-mist">La dirección no existe o fue movida.</p>
        <Button asChild variant="line">
          <Link href="/admin">Ir al panel</Link>
        </Button>
      </div>
    </main>
  );
}
