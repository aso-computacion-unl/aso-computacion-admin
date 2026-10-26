"use client";

import { useState } from "react";

import { Icon } from "@/components/icons";
import { Button } from "@/components/ui/button";

const COPY_FAILED = "No se pudo copiar. Seleccione el link y cópielo a mano.";

export function CopyLink({ link }: { link: string }) {
  const [copied, setCopied] = useState<"yes" | "failed" | null>(null);

  async function copy() {
    try {
      await navigator.clipboard.writeText(link);
      setCopied("yes");
    } catch {
      // No clipboard (insecure context, denied permission): the link stays selectable below.
      setCopied("failed");
    }
  }

  return (
    <div className="grid gap-2">
      <div className="flex flex-wrap items-center gap-3">
        <input
          readOnly
          value={link}
          aria-label="Link de invitación"
          onFocus={(event) => event.currentTarget.select()}
          className="min-h-11 min-w-0 flex-1 basis-72 rounded border border-border bg-card px-3 font-mono text-[0.8125rem]"
        />
        <Button type="button" variant="line" onClick={copy} className="min-h-11">
          <Icon name={copied === "yes" ? "check" : "share"} className="size-4" />
          {copied === "yes" ? "Link copiado" : "Copiar link"}
        </Button>
      </div>
      <p aria-live="polite" className="text-error empty:hidden">
        {copied === "failed" ? COPY_FAILED : null}
      </p>
    </div>
  );
}
