import { Icon } from "@/components/icons";
import { FORUM_LOGIN_ERROR_MESSAGES, type ForumLoginErrorCode } from "@/interface/forum/forum-login-errors";

import { GoogleMark } from "./google-mark";

// The guard answers the same for a visitor, an expired session and a suspended member, so the one place a
// suspended student learns why they are out is the "denied" sign-in error.
const SUSPENSION_HINT = "Si ya participaba en el foro y no puede entrar, es posible que la moderación haya suspendido su cuenta: escriba a la directiva de ASO.";

interface SignInGateProps {
  /** Why the last sign-in attempt failed (the `?error=` of the landing), if it did. */
  problem?: ForumLoginErrorCode;
}

/** What a visitor sees at /foro: the forum's purpose and the only way in. */
export function SignInGate({ problem }: SignInGateProps) {
  return (
    <section aria-labelledby="gate-title" className="mx-auto grid max-w-xl gap-5 rounded-xl border border-border bg-muted p-6 sm:p-8">
      <h1 id="gate-title" className="font-display text-[1.75rem] leading-[1.15] text-balance">
        {problem ? "No pudimos entrar" : "Entre al foro con su cuenta de Google"}
      </h1>
      {problem ? (
        <div role="alert" className="flex gap-2.5 rounded-lg border border-error/45 bg-signal/15 p-3.5 text-[0.9375rem]">
          <Icon name="alert" className="mt-0.5 size-4.5 text-error" />
          <div className="grid gap-1.5">
            <p>{FORUM_LOGIN_ERROR_MESSAGES[problem]}</p>
            {problem === "denied" ? <p className="text-mist">{SUSPENSION_HINT}</p> : null}
          </div>
        </div>
      ) : (
        <p className="text-mist">
          El foro es el espacio de estudiantes de la UNL para preguntar, responder y compartir. Use su correo institucional <strong className="font-semibold text-foreground">@unl.edu.ec</strong>: no hay que
          registrarse, la primera vez se crea su cuenta sola. Para leer los hilos también hay que haber entrado.
        </p>
      )}
      {/* A plain link, not next/link: it starts a redirect flow and must not be prefetched. */}
      <a
        href="/foro/auth/google/start"
        className="inline-flex min-h-12 w-fit items-center justify-center gap-3 rounded border border-white bg-white px-5 font-bold text-[#1f1f1f] transition-colors hover:bg-[#e9eef5]"
      >
        <GoogleMark className="size-5" />
        {problem ? "Entrar de nuevo con Google" : "Entrar con Google"}
      </a>
    </section>
  );
}
