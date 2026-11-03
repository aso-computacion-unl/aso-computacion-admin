import { createCommand } from "@/interface/admin/commands/actions";

import { FormLayout, Panel } from "../../_components/form-layout";
import { CommandForm } from "../_components/command-form";

export default function NewCommandPage() {
  return (
    <FormLayout
      backHref="/admin/commands"
      backLabel="Volver a comandos"
      title="Nuevo comando"
      status="sin guardar"
      description="Se agrega al final de la lista; luego puede moverlo."
    >
      <Panel>
        <CommandForm action={createCommand} submitLabel="Crear comando" />
      </Panel>
    </FormLayout>
  );
}
