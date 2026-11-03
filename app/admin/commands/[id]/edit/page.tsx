import { notFound } from "next/navigation";

import { updateCommand } from "@/interface/admin/commands/actions";
import { getAdminCommand } from "@/interface/admin/commands/commands-admin-read";

import { recordStatus } from "../../../_components/page-header";
import { FormLayout, Panel } from "../../../_components/form-layout";
import { CommandForm } from "../../_components/command-form";

export const dynamic = "force-dynamic";

interface EditCommandPageProps {
  params: Promise<{ id: string }>;
}

export default async function EditCommandPage({ params }: EditCommandPageProps) {
  const { id } = await params;
  const command = await getAdminCommand(id);

  if (!command) notFound();

  return (
    <FormLayout
      backHref="/admin/commands"
      backLabel="Volver a comandos"
      title="Editar comando"
      status={recordStatus(command.command, command.isPublished, "m")}
    >
      <Panel>
        <CommandForm
          action={updateCommand.bind(null, id)}
          submitLabel="Guardar cambios"
          initialValues={{
            command: command.command,
            description: command.description,
            output: command.output,
            isPublished: command.isPublished,
          }}
        />
      </Panel>
    </FormLayout>
  );
}
