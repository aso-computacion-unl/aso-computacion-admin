"use client";

import { useEffect } from "react";

import { Button } from "@/components/ui/button";

interface AdminErrorProps {
  error: Error & { digest?: string };
  reset: () => void;
}

export default function AdminError({ error, reset }: AdminErrorProps) {
  // The digest ties this screen to the server log; the message and stack are never shown.
  useEffect(() => {
    console.error("Admin route error", error.digest);
  }, [error]);

  return (
    <div role="alert" className="mt-8 grid max-w-xl justify-items-start gap-4 border-l-2 border-dashed border-signal pl-5">
      <h1 className="font-display text-[2rem] leading-[1.1]">Algo salió mal</h1>
      <p className="text-mist">No pudimos cargar esta página. Sus cambios guardados no se perdieron. Intente nuevamente en unos segundos.</p>
      {error.digest ? <p className="font-mono text-[0.8125rem] text-mist">Código: {error.digest}</p> : null}
      <Button onClick={reset}>Reintentar</Button>
    </div>
  );
}
