import { notFound } from "next/navigation";

import { getAdminForumCategory } from "@/interface/admin/forum/forum-admin-read";
import { pluralize } from "@/interface/admin/publication-summary";

import { FormLayout, Panel } from "../../../../_components/form-layout";
import { CATEGORIES_PATH, CategoryForm } from "../../_components/category-form";

export const dynamic = "force-dynamic";

interface EditForumCategoryPageProps {
  params: Promise<{ id: string }>;
}

export default async function EditForumCategoryPage({ params }: EditForumCategoryPageProps) {
  const { id } = await params;
  const category = await getAdminForumCategory(id);

  if (!category) notFound();

  return (
    <FormLayout
      backHref={CATEGORIES_PATH}
      backLabel="Volver a categorías"
      title="Editar categoría"
      status={`${category.name} · ${pluralize(category.threadCount, "hilo", "hilos")}`}
    >
      <Panel>
        <CategoryForm mode="edit" id={id} initialValues={{ name: category.name, description: category.description ?? "", slug: category.slug }} />
      </Panel>
    </FormLayout>
  );
}
