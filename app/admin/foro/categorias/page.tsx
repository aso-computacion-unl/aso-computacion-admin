import Link from "next/link";

import { Icon } from "@/components/icons";
import { Button } from "@/components/ui/button";
import { getAdminForumCategories } from "@/interface/admin/forum/forum-admin-read";
import { pluralize } from "@/interface/admin/publication-summary";

import { EmptyState } from "../../_components/empty-state";
import { AddRow } from "../../_components/list-row";
import { PageHeader } from "../../_components/page-header";
import { SectionTitle } from "../../_components/section-title";
import { Stamp, TimelineItem } from "../../_components/timeline-parts";
import { CategoryDeleteButton } from "./_components/category-delete-button";

// Reads mutable data on every request.
export const dynamic = "force-dynamic";

const NEW_PATH = "/admin/foro/categorias/new";

type Category = Awaited<ReturnType<typeof getAdminForumCategories>>[number];

/**
 * One category as a commit of the line. From 1024px the card is a subgrid of the list, so its columns are shared by
 * every row: number | text | threads | Editar | Eliminar, each but the text as wide as its widest value, and the thread
 * counts line up on the right. The delete confirmation takes a strip of the row under the text (from the text column to
 * the end) instead of the actions column. Below 1024px the parts stack: number, text, then threads and the actions in
 * one line with 44px targets, and the confirmation wraps under them.
 */
function CategoryRow({ category, position }: { category: Category; position: number }) {
  const editHref = `/admin/foro/categorias/${category.id}/edit`;

  return (
    <TimelineItem published lane="trunk">
      <div
        data-slot="category-row"
        className="grid gap-2.5 p-4 md:px-5 lg:col-span-full lg:grid-cols-subgrid lg:items-center lg:gap-x-0 lg:gap-y-3 lg:py-3.5"
      >
        <div className="lg:self-start lg:pt-0.5 lg:pr-6">
          <Stamp>{String(position).padStart(2, "0")}</Stamp>
        </div>
        <div className="grid min-w-0 gap-1 lg:pr-6">
          <h3 className="text-base leading-snug font-bold font-stretch-[108%] wrap-anywhere">
            <Link href={editHref} className="rounded-xs underline-offset-4 hover:underline">
              {category.name}
            </Link>
          </h3>
          <p className="font-mono text-[0.8125rem] text-sky wrap-anywhere">/foro?categoria={category.slug}</p>
          {category.description ? <p className="line-clamp-2 max-w-[68ch] text-sm text-mist">{category.description}</p> : null}
        </div>
        <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-3 border-t border-border pt-2 max-lg:[&_a]:min-h-11 max-lg:[&_button]:min-h-11 max-lg:[&_button]:min-w-11 lg:contents">
          <span className="mr-auto font-mono text-[0.8125rem] whitespace-nowrap text-mist tabular-nums lg:mr-0 lg:pr-6 lg:text-right">
            {pluralize(category.threadCount, "hilo", "hilos")}
          </span>
          <div className="lg:flex lg:items-center lg:self-stretch lg:border-l lg:border-border lg:pr-2 lg:pl-6">
            <Button asChild variant="line" size="sm">
              <Link href={editHref} aria-label={`Editar: ${category.name}`}>
                <Icon name="edit" className="size-4" />
                Editar
              </Link>
            </Button>
          </div>
          <div className="contents lg:[&>[role=group]]:col-[2/-1] lg:[&>[role=group]]:grid-cols-[minmax(0,68ch)_auto] lg:[&>[role=group]]:items-center lg:[&>[role=group]]:justify-between lg:[&>[role=group]]:gap-x-6 lg:[&>[role=group]]:px-4 lg:[&>[role=group]>small]:col-span-full">
            <CategoryDeleteButton id={category.id} name={category.name} />
          </div>
        </div>
      </div>
    </TimelineItem>
  );
}

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
        <section aria-labelledby="categories-group" className="mt-8">
          <div className="mb-3 flex flex-wrap items-baseline gap-x-3 gap-y-1">
            <SectionTitle id="categories-group">En el orden del foro</SectionTitle>
            <p className="text-sm text-mist">La 01 se muestra primero</p>
          </div>
          <div className="tl">
            {/* lane | number | text | threads | Editar | Eliminar: each row, its card and the card's content are subgrids of these tracks. */}
            <ol
              aria-label="Categorías del foro, en el orden en que se muestran"
              className="tl-trunk pb-6 lg:grid lg:grid-cols-[var(--lane)_max-content_minmax(0,1fr)_max-content_max-content_minmax(2.5rem,max-content)] lg:[&>li]:col-span-full lg:[&>li]:grid-cols-subgrid lg:[&>li>article]:col-[2/-1] lg:[&>li>article]:grid lg:[&>li>article]:grid-cols-subgrid"
            >
              {categories.map((category, index) => (
                <CategoryRow key={category.id} category={category} position={index + 1} />
              ))}
            </ol>
          </div>
          <AddRow href={NEW_PATH}>Agregar categoría</AddRow>
        </section>
      )}
    </div>
  );
}
