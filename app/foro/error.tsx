"use client";

import * as Sentry from "@sentry/nextjs";
import Link from "next/link";
import { useEffect } from "react";

import { Button } from "@/components/ui/button";

interface ForumErrorProps {
  error: Error & { digest?: string };
  reset: () => void;
}

export default function ForumError({ error, reset }: ForumErrorProps) {
  // The digest ties this screen to the server log; the message and stack are never shown.
  useEffect(() => {
    console.error("Forum route error", error.digest);
    // A no-op while the browser SDK is not configured; scrubbed like every other event.
    Sentry.captureException(error);
  }, [error]);

  return (
    <div role="alert" className="mx-auto mt-8 grid max-w-xl justify-items-start gap-4 border-l-2 border-dashed border-signal pl-5">
      <h1 className="font-display text-[2rem] leading-[1.1]">Algo salió mal</h1>
      <p className="text-mist">No pudimos cargar esta página. Lo que ya publicó no se perdió. Intente nuevamente en unos segundos.</p>
      {error.digest ? <p className="font-mono text-[0.8125rem] text-mist">Código: {error.digest}</p> : null}
      <div className="flex flex-wrap gap-3">
        <Button onClick={reset}>Reintentar</Button>
        <Button asChild variant="line">
          <Link href="/foro">Volver al foro</Link>
        </Button>
      </div>
    </div>
  );
}
