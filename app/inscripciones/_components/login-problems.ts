import type { ForumLoginErrorCode } from "@/interface/forum/forum-login-errors";

/**
 * Why a sign-in failed, in the words of the registrations: the forum's own messages talk about "el foro", and
 * nothing a person reads under `/inscripciones` does (D5, D8).
 */
export const LOGIN_PROBLEM_MESSAGES: Record<ForumLoginErrorCode, string> = {
  unavailable: "El acceso no está disponible ahora. Inténtelo más tarde.",
  failed: "No se pudo completar el acceso con Google. Inténtelo de nuevo.",
  denied: "Esa cuenta no puede entrar. Use su correo institucional @unl.edu.ec.",
  verification: "No pudimos verificar su cuenta con Google en este momento. Inténtelo de nuevo en unos minutos.",
};

/** The Google sign-in of the registrations: the forum's one flow under the hood, which returns to the event's page. */
export function registrationSignInHref(slug: string): string {
  return `/foro/auth/google/start?next=${encodeURIComponent(`/inscripciones/${slug}`)}`;
}

/** The same sign-in from the list's header (S1): it returns to the list. */
export function registrationListSignInHref(): string {
  return `/foro/auth/google/start?next=${encodeURIComponent("/inscripciones")}`;
}
