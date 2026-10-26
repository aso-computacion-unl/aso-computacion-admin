import Link from "next/link";

import { Icon } from "@/components/icons";
import { Button } from "@/components/ui/button";
import { trashCommand, moveCommand, setCommandPublished } from "@/interface/admin/commands/actions";
import { getAdminCommands } from "@/interface/admin/commands/commands-admin-read";
import { publicationSummary } from "@/interface/admin/publication-summary";

import { OrderedRow } from "../_components/ordered-row";
import { PageHead } from "../_components/page-head";
import { DeleteButton, MoveButtons, PublishedToggle } from "../_components/row-actions";
import { EmptyState, OrderedList } from "../_components/timeline-parts";

// Reads mutable data on every request.
export const dynamic = "force-dynamic";

export default async function AdminCommandsPage() {
  const commands = await getAdminCommands();

  return (
    <div>
      <PageHead
        title="Comandos"
        meta={`main · ${publicationSummary(commands)}`}
        action={
          <Button asChild className="min-h-12 flex-none">
            <Link href="/admin/commands/new">
              <Icon name="plus" />
              Nuevo comando
            </Link>
          </Button>
        }
      />
      {commands.length === 0 ? (
        <EmptyState
          action={
            <Button asChild>
              <Link href="/admin/commands/new">
                <Icon name="plus" />
                Crear el primer comando
              </Link>
            </Button>
          }
        >
          Todavía no hay comandos. Los comandos publicados aparecen en la ayuda del terminal en el orden de esta lista.
        </EmptyState>
      ) : (
        <OrderedList label="Comandos, en el orden en que se muestran">
          {commands.map((item, index) => (
            <OrderedRow
              key={item.id}
              published={item.isPublished}
              position={index + 1}
              label={item.command}
              editHref={`/admin/commands/${item.id}/edit`}
              toggle={<PublishedToggle label={item.command} isPublished={item.isPublished} action={setCommandPublished.bind(null, item.id)} />}
              move={
                <MoveButtons
                  label={item.command}
                  isFirst={index === 0}
                  isLast={index === commands.length - 1}
                  position={index + 1}
                  total={commands.length}
                  action={moveCommand.bind(null, item.id)}
                />
              }
              remove={<DeleteButton label={item.command} warning="¿Eliminar este comando?" action={trashCommand.bind(null, item.id)} />}
            >
              <h2 className="text-base leading-snug font-bold font-stretch-[108%] wrap-anywhere">
                <Link href={`/admin/commands/${item.id}/edit`} className="rounded-xs underline-offset-4 hover:underline">
                  ❯ {item.command}
                </Link>
              </h2>
              <p className="line-clamp-2 text-sm text-mist">{item.description}</p>
            </OrderedRow>
          ))}
        </OrderedList>
      )}
    </div>
  );
}
