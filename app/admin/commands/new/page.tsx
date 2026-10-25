import { createCommand } from "@/interface/admin/commands/actions";

import { FormPage, Panel } from "../../_components/page-head";
import { CommandForm } from "../_components/command-form";

export default function NewCommandPage() {
  return (
    <FormPage backHref="/admin/commands" backLabel="Volver a comandos" title="Nuevo comando" meta="Se agrega al final de la lista; luego puede moverlo.">
      <Panel>
        <CommandForm action={createCommand} submitLabel="Crear comando" />
      </Panel>
    </FormPage>
  );
}
