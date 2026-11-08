import { Icon } from "@/components/icons";
import type { ForumLoginErrorCode } from "@/interface/forum/forum-login-errors";

import { PassGoogleButton } from "./pass-google-button";

import "../inscripciones.css";

// The forum's own messages talk about "el foro"; this screen is about the registrations.
const PROBLEM_MESSAGES: Record<ForumLoginErrorCode, string> = {
  unavailable: "El acceso no está disponible ahora. Inténtelo más tarde.",
  failed: "No se pudo completar el acceso con Google. Inténtelo de nuevo.",
  denied: "Esa cuenta no puede entrar. Use su correo institucional @unl.edu.ec.",
  verification: "No pudimos verificar su cuenta con Google en este momento. Inténtelo de nuevo en unos minutos.",
};

interface SignInPassProps {
  /** A validated path to come back to after signing in (the registrations list, or an event's page). */
  next: string;
  /** Why the last sign-in attempt failed (the `?error=` of the redirect), if it did. */
  problem?: ForumLoginErrorCode;
}

/**
 * The full-page sign-in of the registrations: a student pass whose red stub holds the one way in. Light on purpose
 * (a headline, one button, one line); the sign-in itself is the forum's one Google flow, which returns to `next`.
 */
export function SignInPass({ next, problem }: SignInPassProps) {
  return (
    // `data-bleed`: when it is shown inside the forum's layout, that layout lets it fill the width under the top bar.
    <div data-bleed className="pass-page">
      <section className="pass" aria-labelledby="pass-title">
        <div className="pass-main">
          <p className="pass-tag">Pase · Inscripciones</p>
          <h1 id="pass-title" className="pass-title">
            Su pase de estudiante
          </h1>
          <div className="pass-fields" aria-hidden="true">
            <span>Nombre</span>
            <span>Actividad</span>
          </div>
        </div>
        <div className="pass-stub">
          <span className="pass-notch" data-side="a" aria-hidden="true" />
          <span className="pass-notch" data-side="b" aria-hidden="true" />
          <p className="pass-tag">Entrada</p>
          {problem ? (
            <p role="alert" className="pass-error">
              <Icon name="alert" className="size-4" />
              {PROBLEM_MESSAGES[problem]}
            </p>
          ) : null}
          <PassGoogleButton href={`/foro/auth/google/start?next=${encodeURIComponent(next)}`}>{problem ? "Intentar de nuevo" : "Entrar con Google"}</PassGoogleButton>
          <p className="pass-note">
            Solo con su correo <b>@unl.edu.ec</b>
          </p>
        </div>
      </section>
    </div>
  );
}
