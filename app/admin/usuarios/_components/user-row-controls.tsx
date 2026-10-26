"use client";

import { useEffect, useState } from "react";

import { Icon } from "@/components/icons";
import { Button } from "@/components/ui/button";
import { Select } from "@/components/ui/select";
import { ROLES, type Role } from "@/domain/user";
import { changeUserRole, setUserActive } from "@/interface/admin/users/actions";
import { ROLE_LABELS } from "@/interface/admin/role-labels";

import { FieldError } from "../../_components/form-parts";
import { DeleteButton } from "../../_components/row-actions";
import { resultMessage, useRunAction } from "../../_components/use-run-action";

export function UserRoleSelect({ id, name, role }: { id: string; name: string; role: Role }) {
  const { pending, result, run } = useRunAction();
  const [shown, setShown] = useState<Role>(role);
  const message = resultMessage(result);

  // A refused change (the last admin) puts the select back on what is stored.
  useEffect(() => {
    if (message) setShown(role);
  }, [message, role]);

  return (
    <div className="grid gap-1">
      <Select
        aria-label={`Rol de ${name}`}
        value={shown}
        disabled={pending}
        onChange={(event) => {
          setShown(event.target.value as Role);
          run(() => changeUserRole(id, event.target.value), undefined, `Rol de «${name}» cambiado.`);
        }}
      >
        {ROLES.map((option) => (
          <option key={option} value={option}>
            {ROLE_LABELS[option]}
          </option>
        ))}
      </Select>
      {message ? <FieldError>{message}</FieldError> : null}
    </div>
  );
}

export function UserActiveControl({ id, name, active }: { id: string; name: string; active: boolean }) {
  const { pending, result, run } = useRunAction();
  const message = resultMessage(result);

  if (active) {
    return (
      <DeleteButton
        label={name}
        warning={`«${name}» ya no podrá entrar y se cerrarán todas sus sesiones.`}
        note="Podrá volver a activarlo cuando quiera."
        triggerLabel="Desactivar"
        confirmLabel="Sí, desactivar"
        successMessage="Usuario desactivado."
        action={() => setUserActive(id, false)}
      />
    );
  }

  return (
    <>
      <Button variant="line" size="sm" busy={pending} aria-label={`Reactivar: ${name}`} aria-disabled={pending || undefined} onClick={() => !pending && run(() => setUserActive(id, true), undefined, "Usuario reactivado.")}>
        <Icon name="undo" className="size-4" />
        Reactivar
      </Button>
      {message ? <FieldError>{message}</FieldError> : null}
    </>
  );
}
