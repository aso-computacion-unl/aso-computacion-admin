/** What the forum landing page can be told about a failed sign-in (in the `?error=` query). */
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
