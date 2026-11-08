import type { ReactNode } from "react";

import { FORUM_LOGIN_ERROR_MESSAGES, type ForumLoginErrorCode } from "@/interface/forum/forum-login-errors";

import { AuthAlert } from "../../_components/auth-alert";
import { GoogleButton } from "../../_components/google-button";

// The guard answers the same for a visitor, an expired session and a suspended member, so the one place a
// suspended student learns why they are out is the "denied" sign-in error.
const SUSPENSION_HINT = "Si ya participaba en el foro y no puede entrar, es posible que la moderación haya suspendido su cuenta: escriba a la directiva de ASO.";

interface SignInGateProps {
  /** Why the last sign-in attempt failed (the `?error=` of the landing), if it did. */
  problem?: ForumLoginErrorCode;
  /** A validated forum path to come back to after signing in (`parseForumReturnPath`), if the visitor arrived for a page. */
  next?: string;
}

// Authored on the icon set's 24px grid, but the set has no light bulb and the tiles want one stroke weight across all three.
const REASONS: ReadonlyArray<{ word: string; hint: string; icon: ReactNode }> = [
  {
    word: "Preguntar",
    hint: "Dudas de materias",
    icon: (
      <>
        <path d="M4 4.5h16v11H9.5L5 19.5v-4H4z" />
        <path d="M10 8.6a2 2 0 1 1 2.6 1.9c-.5.2-.6.6-.6 1.1M12 13.3h.01" />
      </>
    ),
  },
  {
    word: "Proponer",
    hint: "Talleres y charlas",
    icon: <path d="M9 18h6M10 21h4M12 2.8a6 6 0 0 0-3.6 10.8c.6.5 1.1 1.2 1.1 2.1v.3h5v-.3c0-.9.5-1.6 1.1-2.1A6 6 0 0 0 12 2.8z" />,
  },
  {
    word: "Armar equipo",
    hint: "Para el próximo evento",
    icon: (
      <>
        <circle cx="8" cy="8" r="3" />
        <path d="M2.5 20c0-3 2.5-5.5 5.5-5.5s5.5 2.5 5.5 5.5" />
        <circle cx="17" cy="9" r="2.5" />
        <path d="M15.8 14.3c3.2.1 5.7 1.9 5.7 5.7" />
      </>
    ),
  },
];

/** What a visitor sees at /foro: three reasons to come in and the one way in. Nothing of the forum shows before the sign-in. */
export function SignInGate({ problem, next }: SignInGateProps) {
  return (
    // `data-bleed`: the forum layout lets the sign-in fill the width under the top bar.
    <div data-bleed>
      <section
        aria-labelledby="gate-title"
        className="flex min-h-[calc(100dvh-3.5rem)] flex-col gap-8 px-6 py-8 min-[900px]:gap-[clamp(2rem,5vh,2.75rem)] min-[900px]:px-[clamp(1.5rem,5vw,6rem)] min-[900px]:py-[clamp(2rem,5vh,3.5rem)]"
      >
        <div className="flex flex-col gap-8 min-[900px]:flex-row min-[900px]:items-end min-[900px]:justify-between min-[900px]:gap-12">
          <h1
            id="gate-title"
            className="font-display text-[clamp(2.25rem,10.4vw,3rem)] leading-[1.02] tracking-[-0.03em] text-balance min-[900px]:max-w-[12ch] min-[900px]:text-[clamp(3rem,6.7vw,6rem)] min-[900px]:leading-[0.95]"
          >
            Su carrera se resuelve <span className="underline decoration-signal decoration-[0.09em] underline-offset-[0.1em]">aquí</span>
          </h1>

          <div className="flex flex-col gap-4 min-[900px]:items-end min-[900px]:pb-2">
            {problem ? (
              <AuthAlert className="max-w-[36rem]">
                <p>{FORUM_LOGIN_ERROR_MESSAGES[problem]}</p>
                {problem === "denied" ? <p className="text-mist">{SUSPENSION_HINT}</p> : null}
              </AuthAlert>
            ) : null}
            <GoogleButton
              href={next ? `/foro/auth/google/start?next=${encodeURIComponent(next)}` : "/foro/auth/google/start"}
              className="min-h-16 w-full px-4 text-center text-[1.0625rem] font-extrabold min-[900px]:min-h-[4.5rem] min-[900px]:w-auto min-[900px]:px-10 min-[900px]:text-[1.4375rem] [&_svg]:size-[1.2em]"
            >
              {problem ? "Entrar de nuevo con Google" : "Entrar con Google"}
            </GoogleButton>
            <p className="font-mono text-[0.9375rem] leading-snug text-mist min-[900px]:text-right">
              Solo con su correo <strong className="font-semibold text-foreground">@unl.edu.ec</strong>. La primera vez se crea su cuenta.
            </p>
          </div>
        </div>

        <ul className="grid gap-3 min-[900px]:min-h-[21rem] min-[900px]:flex-1 min-[900px]:grid-cols-3 min-[900px]:gap-5">
          {REASONS.map((reason) => (
            <li
              key={reason.word}
              className="flex items-center gap-4 rounded-lg border border-border bg-card px-5 py-4 min-[900px]:flex-col min-[900px]:items-start min-[900px]:justify-between min-[900px]:gap-6 min-[900px]:p-9"
            >
              <svg
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth={1.5}
                strokeLinecap="round"
                strokeLinejoin="round"
                aria-hidden="true"
                focusable="false"
                className="size-10 shrink-0 text-sky min-[900px]:size-[clamp(4.5rem,6.7vw,6rem)]"
              >
                {reason.icon}
              </svg>
              <div>
                <h2 className="font-display text-[1.75rem] leading-none font-extrabold tracking-[-0.03em] min-[900px]:text-[clamp(2.5rem,4.4vw,4rem)] min-[900px]:leading-[0.95]">{reason.word}</h2>
                <p className="mt-1.5 font-mono text-base font-semibold text-mist min-[900px]:mt-3.5">{reason.hint}</p>
              </div>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
