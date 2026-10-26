"use client";

import { useEffect } from "react";

import { Icon } from "@/components/icons";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { INVITE_TTL_DAYS } from "@/domain/admin-invite";
import { ROLES } from "@/domain/user";
import type { ActionResult } from "@/interface/admin/action-result";
import { ROLE_LABELS } from "@/interface/admin/role-labels";

import { Field, FieldError } from "../../_components/form-parts";
import { useControlledForm } from "../../_components/use-controlled-form";

import { CopyLink } from "./copy-link";

interface CreateInviteFormProps {
  action: (prevState: ActionResult | null, formData: FormData) => Promise<ActionResult>;
}

const INITIAL = { email: "", role: "EDITOR" };

export function CreateInviteForm({ action }: CreateInviteFormProps) {
  const { bind, handleSubmit, reset, state, isPending, errors } = useControlledForm(action, INITIAL);
  const saved = state?.success === true;
  // The action also returns the link; the shared form hook types every result as a plain `ActionResult`.
  const link = state && "link" in state && typeof state.link === "string" ? state.link : undefined;

  useEffect(() => {
    if (saved) reset();
    // `state` is a new object per submit; `reset` only sets state back to the constants above.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state]);

  return (
    <form onSubmit={handleSubmit} noValidate className="grid gap-5">
      <div className="grid gap-x-4 gap-y-5 @xl:grid-cols-2">
        <Field label="Correo" hint="El de la cuenta de Google con la que entrará." error={errors.email}>
          {(control) => <Input type="email" inputMode="email" autoComplete="off" {...control} {...bind("email")} required />}
        </Field>
        <Field label="Rol" error={errors.role}>
          {(control) => (
            <Select {...control} {...bind("role")} required>
              {ROLES.map((role) => (
                <option key={role} value={role}>
                  {ROLE_LABELS[role]}
                </option>
              ))}
            </Select>
          )}
        </Field>
      </div>
      <div className="flex flex-wrap items-center gap-4">
        <Button type="submit" busy={isPending} aria-disabled={isPending || undefined} className="min-h-12">
          {isPending ? "Creando…" : "Crear invitación"}
        </Button>
        <div aria-live="polite" className="min-w-0 text-sm">
          {state?.error ? <FieldError>{state.error}</FieldError> : null}
        </div>
      </div>
      {link ? (
        <div role="status" className="grid gap-3 rounded bg-muted p-4 text-sm">
          <p className="flex items-center gap-2 font-semibold text-sky">
            <Icon name="check" className="size-4 stroke-[2.25]" />
            Invitación creada. Envíe este link a la persona invitada.
          </p>
          <CopyLink link={link} />
          <p className="text-mist">
            Vence en {INVITE_TTL_DAYS} días y funciona una sola vez. Solo sirve con la cuenta de Google del correo indicado. No se vuelve a mostrar: si lo pierde, cree otra
            invitación.
          </p>
        </div>
      ) : null}
    </form>
  );
}
