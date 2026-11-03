"use client";

import { useState, useTransition } from "react";

import { Button } from "@/components/ui/button";
import { registerForEvent } from "@/interface/forum/event-registration";

/** Registers the signed-in member and says what happened; the page behind it refreshes by itself on success. */
export function RegisterButton({ slug }: { slug: string }) {
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function register() {
    setError(null);
    startTransition(async () => {
      const result = await registerForEvent(slug);

      if (result.error) setError(result.error);
    });
  }

  return (
    <div className="grid gap-2">
      <Button type="button" busy={isPending} aria-disabled={isPending || undefined} onClick={isPending ? undefined : register} className="min-h-12 justify-self-start">
        {isPending ? "Inscribiendo…" : "Inscribirme"}
      </Button>
      {error ? (
        <p role="alert" className="text-sm text-destructive">
          {error}
        </p>
      ) : null}
    </div>
  );
}
