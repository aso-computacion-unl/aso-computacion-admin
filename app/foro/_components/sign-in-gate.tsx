import { FORUM_LOGIN_ERROR_MESSAGES, type ForumLoginErrorCode } from "@/interface/forum/forum-login-errors";

import { AuthAlert } from "../../_components/auth-alert";
import { AuthBranch, BranchGoogleButton, BranchLead, BranchNode } from "../../_components/auth-branch";

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
 * Made-up threads, one node per category, that show what the forum looks like inside. Reading the real ones needs a
 * session, so the preview never comes from the database.
 */
const SAMPLE_CATEGORIES = [
  {
    name: "materias",
    threads: [
      { open: true, title: "¿Cómo preparo el examen de Estructuras de Datos?", when: "hace 2 h", replies: 6 },
      { open: false, title: "Error al conectar Postgres desde Docker en el laboratorio", when: "hace 5 h", replies: 9 },
    ],
  },
  { name: "propuestas", threads: [{ open: true, title: "Propuesta: taller de Docker para primeros ciclos", when: "ayer", replies: 14 }] },
  { name: "general", threads: [{ open: true, title: "Busco equipo para el hackathon (backend con Node)", when: "ayer", replies: 3 }] },
] as const;

/** What a visitor sees at /foro: what the forum is, a look inside, and the only way in. */
export function SignInGate({ problem, next }: SignInGateProps) {
  return (
    // `data-bleed`: the forum layout lets the sign-in fill the width under the top bar.
    <div data-bleed>
      <AuthBranch
        branch="foro"
        title="El foro de Computación"
        titleId="gate-title"
        belowTopBar
        note="Hilos de ejemplo: después de entrar verá los reales."
        head={
          <>
            <BranchLead>Pregunte sobre materias, proponga talleres y arme equipo para el próximo evento. Es el espacio de los estudiantes de Computación de la UNL.</BranchLead>
            {problem ? (
              <AuthAlert className="mb-4 max-w-[34rem]">
                <p>{FORUM_LOGIN_ERROR_MESSAGES[problem]}</p>
                {problem === "denied" ? <p className="text-mist">{SUSPENSION_HINT}</p> : null}
              </AuthAlert>
            ) : null}
            <BranchGoogleButton href={next ? `/foro/auth/google/start?next=${encodeURIComponent(next)}` : "/foro/auth/google/start"}>
              {problem ? "Entrar de nuevo con Google" : "Entrar con Google"}
            </BranchGoogleButton>
            <p className="mt-4 max-w-[34rem] text-base text-mist">
              Solo con su correo institucional <strong className="font-semibold text-foreground">@unl.edu.ec</strong>. La primera vez se crea su cuenta: no hay que registrarse.
            </p>
          </>
        }
        nodes={SAMPLE_CATEGORIES.map((category) => (
          <BranchNode key={category.name} hash={category.name} decorative>
            <ul className="grid gap-4.5">
              {category.threads.map((thread) => (
                <li key={thread.title}>
                  <p className="mb-1.5 font-[750] font-stretch-[112%] text-[clamp(1.125rem,1.4vw,1.625rem)] leading-[1.15] tracking-[-0.015em] text-balance">{thread.title}</p>
                  <p className="flex flex-wrap gap-x-3 font-mono text-sm text-mist">
                    <span className={thread.open ? "text-sky" : "text-ok"}>{thread.open ? "abierto" : "resuelto"}</span>
                    <span>{thread.when}</span>
                    <span>{thread.replies} respuestas</span>
                  </p>
                </li>
              ))}
            </ul>
          </BranchNode>
        ))}
      />
    </div>
  );
}
