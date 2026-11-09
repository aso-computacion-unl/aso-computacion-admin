/** What a screen that offers the forum's Google sign-in can be told about a failed one (in the `?error=` query). */
export const FORUM_LOGIN_ERRORS = ["unavailable", "failed", "denied", "verification"] as const;

export type ForumLoginErrorCode = (typeof FORUM_LOGIN_ERRORS)[number];

export function parseForumLoginError(raw: string | string[] | undefined): ForumLoginErrorCode | undefined {
  return FORUM_LOGIN_ERRORS.find((code) => code === raw);
}

export const FORUM_LOGIN_ERROR_MESSAGES: Record<ForumLoginErrorCode, string> = {
  unavailable: "El acceso al foro no está disponible ahora. Intente más tarde.",
  failed: "No se pudo completar el acceso con Google. Inténtelo de nuevo.",
  denied: "Solo pueden entrar estudiantes con su cuenta institucional verificada.",
  verification: "No pudimos verificar su cuenta con Google en este momento. Inténtelo de nuevo en unos minutos.",
};

/**
 * The forum landing also hears of a suspended account (D1), a code of its own so that "denied" stays the one generic
 * refusal. The callback sends it only after Google proved the account is the person's, and always to the landing
 * (`/foro`), so the other screens that show a sign-in problem never receive it.
 */
export const FORUM_LANDING_ERRORS = [...FORUM_LOGIN_ERRORS, "suspended"] as const;

export type ForumLandingErrorCode = (typeof FORUM_LANDING_ERRORS)[number];

export function parseForumLandingError(raw: string | string[] | undefined): ForumLandingErrorCode | undefined {
  return FORUM_LANDING_ERRORS.find((code) => code === raw);
}

export const FORUM_LANDING_ERROR_MESSAGES: Record<ForumLandingErrorCode, string> = {
  ...FORUM_LOGIN_ERROR_MESSAGES,
  suspended: "Su cuenta del foro está suspendida. Para resolverlo, escriba a la directiva de ASO.",
};
