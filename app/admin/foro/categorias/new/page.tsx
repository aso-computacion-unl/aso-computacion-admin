import { requirePageSession } from "@/interface/auth/require-page-session";

import { PageFrame } from "../../../_components/form-layout";
import { CategoryForm, CategoryHeader } from "../_components/category-form";

// Reads the session on every request.
export const dynamic = "force-dynamic";

export default async function NewForumCategoryPage() {
  await requirePageSession("ADMIN");

  return (
    <PageFrame>
      <CategoryHeader title="Nueva categoría" status="sin guardar" description="Se agrega al final de la lista. Los estudiantes la ven en el foro en cuanto se guarda." />
      <CategoryForm mode="create" />
    </PageFrame>
  );
}
