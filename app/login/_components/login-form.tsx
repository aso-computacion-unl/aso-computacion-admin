"use client";

import { useActionState } from "react";

import { Icon } from "@/components/icons";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { LoginResult } from "@/interface/auth/actions";

interface LoginFormProps {
  action: (prevState: LoginResult | null, formData: FormData) => Promise<LoginResult>;
}

export function LoginForm({ action }: LoginFormProps) {
  const [state, formAction, isPending] = useActionState(action, null);
  // Only a wrong password marks the field; a service failure is reported for the whole form.
  const fieldError = state?.field === "password" ? state.error : undefined;
  const formError = state?.error && !fieldError ? state.error : undefined;

  return (
    <form action={formAction} className="grid gap-3">
      {formError ? (
        <p role="alert" className="flex items-start gap-2 border-l-2 border-error bg-error/10 px-3 py-2 text-sm">
          <Icon name="alert" className="mt-px size-4 shrink-0 text-error" />
          {formError}
        </p>
      ) : null}
      <div className="grid gap-1.5">
        <Label htmlFor="password">Contraseña</Label>
        <Input
          id="password"
          type="password"
          name="password"
          required
          autoComplete="current-password"
          disabled={isPending}
          aria-invalid={fieldError ? true : undefined}
          aria-describedby={fieldError ? "password-error" : undefined}
        />
      </div>
      {fieldError ? (
        <p id="password-error" role="alert" aria-live="polite" className="flex items-start gap-2 text-sm font-semibold text-error">
          <Icon name="alert" className="mt-px size-4" />
          {fieldError}
        </p>
      ) : null}
      <Button type="submit" busy={isPending} disabled={isPending} className="mt-1 min-h-12">
        {isPending ? "Iniciando sesión…" : "Iniciar sesión"}
      </Button>
    </form>
  );
}
