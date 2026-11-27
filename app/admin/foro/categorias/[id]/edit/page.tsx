import { notFound } from "next/navigation";

import { getAdminForumCategory } from "@/interface/admin/forum/forum-admin-read";

import { PageFrame } from "../../../../_components/form-layout";
import { CategoryForm, CategoryHeader } from "../../_components/category-form";

export const dynamic = "force-dynamic";

interface EditForumCategoryPageProps {
  params: Promise<{ id: string }>;
}

export default async function EditForumCategoryPage({ params }: EditForumCategoryPageProps) {
  const { id } = await params;
  const category = await getAdminForumCategory(id);

  if (!category) notFound();

  return (
    <PageFrame>
      <CategoryHeader title={category.name} />
      <CategoryForm
        mode="edit"
        id={id}
        initialValues={{ name: category.name, description: category.description ?? "", slug: category.slug }}
        threadCount={category.threadCount}
      />
    </PageFrame>
  );
}
