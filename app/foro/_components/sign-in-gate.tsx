import { Icon } from "@/components/icons";
import { FORUM_LOGIN_ERROR_MESSAGES, type ForumLoginErrorCode } from "@/interface/forum/forum-login-errors";

import { AuthSplit } from "../../_components/auth-split";
import { GoogleButton } from "../../_components/google-button";

import { CategoryChip } from "./category-chip";
import { ThreadStatusIcon } from "./thread-status-icon";

// The guard answers the same for a visitor, an expired session and a suspended member, so the one place a
// suspended student learns why they are out is the "denied" sign-in error.
const SUSPENSION_HINT = "Si ya participaba en el foro y no puede entrar, es posible que la moderación haya suspendido su cuenta: escriba a la directiva de ASO.";

interface SignInGateProps {
  /** Why the last sign-in attempt failed (the `?error=` of the landing), if it did. */
  problem?: ForumLoginErrorCode;
  /** A validated forum path to come back to after signing in (`parseForumReturnPath`), if the visitor arrived for a page. */
  next?: string;
}

/**
 * Made-up threads that show what the forum looks like inside. Reading the real ones needs a session, so the
 * preview never comes from the database.
 */
const SAMPLE_THREADS = [
  { status: "open", title: "¿Cómo preparo el examen de Estructuras de Datos?", category: { slug: "materias", name: "Materias" }, meta: "hace 2 h", replies: 6 },
  { status: "solved", title: "Error al conectar Postgres desde Docker en el laboratorio", category: { slug: "materias", name: "Materias" }, meta: "hace 5 h", replies: 9 },
  { status: "open", title: "Propuesta: taller de Docker para primeros ciclos", category: { slug: "propuestas", name: "Propuestas" }, meta: "ayer", replies: 14 },
  { status: "open", title: "Busco equipo para el hackathon (backend con Node)", category: { slug: "general", name: "General" }, meta: "ayer", replies: 3 },
] as const;

/** What a visitor sees at /foro: what the forum is, a look inside, and the only way in. */
export function SignInGate({ problem, next }: SignInGateProps) {
  return (
    // `data-bleed`: the forum layout lets the sign-in fill the width under the top bar.
    <div data-bleed>
      <AuthSplit
        panelLabel="Sobre el foro"
        headline="Entre estudiantes nos ayudamos."
        lines={["Dudas de materias, propuestas de talleres y equipos para cada evento.", "Un espacio para los estudiantes de Computación de la UNL."]}
        terminal="git switch foro"
        visual={<ForumPreview />}
        belowTopBar
      >
        <section aria-labelledby="gate-title" className="grid gap-6">
          <h1 id="gate-title" className="text-[clamp(2rem,4.2vw,2.75rem)] leading-[1.1] font-bold font-stretch-[106%] tracking-tight text-balance">
            {problem ? "No pudimos entrar" : "El foro de Computación"}
          </h1>

          {problem ? (
            <div role="alert" className="flex gap-2.5 rounded-lg border border-error/45 bg-signal/15 p-3.5 text-[0.9375rem]">
              <Icon name="alert" className="mt-0.5 size-4.5 shrink-0 text-error" />
              <div className="grid gap-1.5">
                <p>{FORUM_LOGIN_ERROR_MESSAGES[problem]}</p>
                {problem === "denied" ? <p className="text-mist">{SUSPENSION_HINT}</p> : null}
              </div>
            </div>
          ) : (
            <p className="max-w-[34ch] text-lg leading-relaxed text-mist">
              Pregunte sobre materias, proponga talleres y arme equipo para el próximo evento. Es el espacio de los estudiantes de la UNL.
            </p>
          )}

          <div className="grid gap-3">
            <GoogleButton href={next ? `/foro/auth/google/start?next=${encodeURIComponent(next)}` : "/foro/auth/google/start"}>{problem ? "Entrar de nuevo con Google" : "Entrar con Google"}</GoogleButton>
            <p className="text-sm text-mist">
              Solo con su correo institucional <strong className="font-semibold text-foreground">@unl.edu.ec</strong>. La primera vez se crea su cuenta: no hay que registrarse.
            </p>
          </div>
        </section>
      </AuthSplit>
    </div>
  );
}

/** A still picture of the thread list: decoration for sighted visitors, hidden from assistive technology and inert. */
function ForumPreview() {
  return (
    <div aria-hidden="true" inert className="relative select-none">
      <div className="overflow-hidden rounded-xl border border-border bg-muted shadow-[0_24px_60px_-28px_rgb(0_0_0/0.6)] [mask-image:linear-gradient(to_bottom,black_62%,transparent)]">
        <div className="flex items-center gap-5 border-b border-border px-4 py-3 text-sm">
          <span className="flex items-center gap-1.5 font-semibold">
            <Icon name="dot" className="size-4 text-ok" />
            24 abiertos
          </span>
          <span className="flex items-center gap-1.5 text-mist">
            <Icon name="check" className="size-4" />
            87 resueltos
          </span>
          <span className="ml-auto font-mono text-xs text-mist">vista de ejemplo</span>
        </div>
        <ul className="divide-y divide-border/50">
          {SAMPLE_THREADS.map((thread) => (
            <li key={thread.title} className="flex items-start gap-3 px-4 py-3">
              <span className="mt-0.5 [&_svg]:size-4">
                <ThreadStatusIcon status={thread.status} />
              </span>
              <div className="grid min-w-0 flex-1 gap-1">
                <p className="truncate font-semibold">{thread.title}</p>
                <p className="flex items-center gap-2 text-xs text-mist">
                  <CategoryChip category={thread.category} />
                  {thread.meta}
                </p>
              </div>
              <span className="flex items-center gap-1 text-xs text-mist">
                <Icon name="msg" className="size-3.5" />
                {thread.replies}
              </span>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
