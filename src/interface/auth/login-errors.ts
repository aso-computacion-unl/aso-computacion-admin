/** The codes the Google routes put in `/login?error=`. */
export const LOGIN_ERROR_MESSAGES = {
  denied: "Esta cuenta no tiene acceso.",
  throttled: "Demasiados intentos. Intente de nuevo más tarde.",
  unavailable: "El acceso no está disponible en este momento. Intente de nuevo en unos minutos.",
  failed: "No se pudo completar el acceso con Google. Intente de nuevo.",
} as const;

export type LoginErrorCode = keyof typeof LOGIN_ERROR_MESSAGES;

/** The message for a `?error=` value, or nothing for a value that is not one of ours (the URL is user input). */
export function loginErrorMessage(code: string | string[] | undefined): string | undefined {
  return typeof code === "string" && Object.hasOwn(LOGIN_ERROR_MESSAGES, code) ? LOGIN_ERROR_MESSAGES[code as LoginErrorCode] : undefined;
}
