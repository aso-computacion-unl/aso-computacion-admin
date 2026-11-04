import Link from "next/link";

import { Icon } from "@/components/icons";
import { Button } from "@/components/ui/button";
import { getAdminForumCategories } from "@/interface/admin/forum/forum-admin-read";
import { pluralize } from "@/interface/admin/publication-summary";

import { EmptyState } from "../../_components/empty-state";
import { AddRow, ListRow } from "../../_components/list-row";
import { PageHeader } from "../../_components/page-header";
import { OrderedList, Stamp } from "../../_components/timeline-parts";
import { CategoryDeleteButton } from "./_components/category-delete-button";

// Reads mutable data on every request.
export const dynamic = "force-dynamic";

const NEW_PATH = "/admin/foro/categorias/new";

export default async function AdminForumCategoriesPage() {
  const categories = await getAdminForumCategories();

  return (
    <div>
      <PageHeader
        title="Categorías del foro"
        status={pluralize(categories.length, "categoría", "categorías")}
        description="Los estudiantes abren sus hilos dentro de una categoría. Aparecen en el foro en el orden de esta lista."
        action={
          <Button asChild>
            <Link href={NEW_PATH}>
              <Icon name="plus" />
              Nueva categoría
            </Link>
          </Button>
        }
      />
      {categories.length === 0 ? (
        <EmptyState
          icon="msg"
          action={
            <Button asChild>
              <Link href={NEW_PATH}>
                <Icon name="plus" />
                Crear la primera categoría
              </Link>
            </Button>
          }
        >
          Todavía no hay categorías. Mientras no exista una, los estudiantes no pueden abrir hilos en el foro.
        </EmptyState>
      ) : (
        <>
          <OrderedList label="Categorías del foro, en el orden en que se muestran">
            {categories.map((category, index) => (
              <ListRow
                key={category.id}
                id={category.id}
                label={category.name}
                published
                lane="trunk"
                lead={<Stamp>{String(index + 1).padStart(2, "0")}</Stamp>}
                toggle={<span className="inline-flex min-h-11 items-center font-mono text-[0.8125rem] text-mist min-[84rem]:min-w-34">{pluralize(category.threadCount, "hilo", "hilos")}</span>}
                editHref={`/admin/foro/categorias/${category.id}/edit`}
                remove={<CategoryDeleteButton id={category.id} name={category.name} />}
              >
                <h2 className="text-base leading-snug font-bold font-stretch-[108%] wrap-anywhere">
                  <Link href={`/admin/foro/categorias/${category.id}/edit`} className="rounded-xs underline-offset-4 hover:underline">
                    {category.name}
                  </Link>
                </h2>
                <p className="font-mono text-[0.8125rem] text-sky wrap-anywhere">/foro?categoria={category.slug}</p>
                {category.description ? <p className="line-clamp-2 text-sm text-mist">{category.description}</p> : null}
              </ListRow>
            ))}
          </OrderedList>
          <AddRow href={NEW_PATH}>Agregar categoría</AddRow>
        </>
      )}
    </div>
  );
}
