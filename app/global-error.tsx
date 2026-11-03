"use client";

import * as Sentry from "@sentry/nextjs";
import { useEffect } from "react";

interface GlobalErrorProps {
  error: Error & { digest?: string };
}

// Last resort for an error in the root layout, where no other boundary (and no stylesheet) is available.
export default function GlobalError({ error }: GlobalErrorProps) {
  useEffect(() => {
    Sentry.captureException(error);
  }, [error]);

  return (
    <html lang="es">
      <body style={{ fontFamily: "system-ui, sans-serif", padding: "2rem" }}>
        <h1>Algo salió mal</h1>
        <p>No pudimos cargar la página. Intente nuevamente en unos segundos.</p>
        {error.digest ? <p>Código: {error.digest}</p> : null}
      </body>
    </html>
  );
}
