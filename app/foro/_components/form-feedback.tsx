import Link from "next/link";
import type { ReactNode } from "react";

import { Icon } from "@/components/icons";
import { Label } from "@/components/ui/label";
import type { ForumActionResult } from "@/interface/forum/forum-action-result";
import { forumSignInHref } from "@/interface/forum/forum-return-path";

/** A labelled control with its hint and error wired together, so a screen reader reads them as one field. */
export function ForumField({ id, label, hint, error, children }: { id: string; label: string; hint?: string; error?: string; children: (describedBy: string | undefined) => ReactNode }) {
  const describedBy = [hint && `${id}-hint`, error && `${id}-error`].filter(Boolean).join(" ") || undefined;

  return (
    <div className="grid min-w-0 gap-1.5">
      <Label htmlFor={id}>{label}</Label>
      {children(describedBy)}
      {hint ? (
        <small id={`${id}-hint`} className="text-[0.8125rem] leading-[1.4] text-mist">
          {hint}
        </small>
      ) : null}
      {error ? (
        <small id={`${id}-error`} role="alert" className="flex items-start gap-1.5 text-[0.8125rem] leading-[1.35] font-semibold text-error">
          <Icon name="alert" className="mt-px size-3.5" />
          {error}
        </small>
      ) : null}
    </div>
  );
}

/**
 * The outcome of a refused submit that belongs to no field: the server's message and a way out. When the
 * session is gone the way out is the sign-in, which brings the member back to `returnTo` (the form's own
 * page, where the draft is waiting); otherwise it is the way back to the forum.
 */
export function SubmitError({ result, returnTo }: { result: ForumActionResult | null; returnTo?: string }) {
  const message = result?.error ?? result?.fieldErrors?.form;

  if (!message) return null;

  return (
    <div role="alert" className="flex gap-2 rounded-lg border border-error/45 bg-signal/15 p-3 text-sm">
      <Icon name="alert" className="mt-0.5 size-4 shrink-0 text-error" />
      <div className="grid gap-1">
        <p>{message}</p>
        {result?.sessionExpired && returnTo ? <p className="text-mist">Lo que escribió se conserva: al volver lo encontrará aquí.</p> : null}
        {result?.error ? (
          <Link href={result.sessionExpired ? forumSignInHref(returnTo) : "/foro"} className="w-fit text-sky-bright underline underline-offset-4">
            {result.sessionExpired ? "Iniciar sesión" : "Volver al foro"}
          </Link>
        ) : null}
      </div>
    </div>
  );
}
