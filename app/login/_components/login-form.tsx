"use client";

import { useActionState } from "react";

import type { LoginResult } from "@/interface/auth/actions";

interface LoginFormProps {
  action: (prevState: LoginResult | null, formData: FormData) => Promise<LoginResult>;
}

export function LoginForm({ action }: LoginFormProps) {
  const [state, formAction, isPending] = useActionState(action, null);

  return (
    <form className="login-form" action={formAction}>
      <label htmlFor="password">Contraseña</label>
      <input
        id="password"
        type="password"
        name="password"
        required
        autoComplete="current-password"
        disabled={isPending}
      />
      <button type="submit" disabled={isPending}>
        {isPending ? "Iniciando sesión…" : "Iniciar sesión"}
      </button>
      {state?.error ? (
        <p role="alert" aria-live="polite">
          {state.error}
        </p>
      ) : null}
    </form>
  );
}
