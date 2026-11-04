import { requirePageSession } from "@/interface/auth/require-page-session";

import { FormLayout, Panel } from "../../../_components/form-layout";
import { CATEGORIES_PATH, CategoryForm } from "../_components/category-form";

// Reads the session on every request.
export const dynamic = "force-dynamic";

export default async function NewForumCategoryPage() {
  await requirePageSession("ADMIN");

  return (
    <FormLayout
      backHref={CATEGORIES_PATH}
      backLabel="Volver a categorías"
      title="Nueva categoría"
      status="sin guardar"
      description="Se agrega al final de la lista. Los estudiantes la ven en el foro en cuanto se guarda."
    >
      <Panel>
        <CategoryForm mode="create" />
      </Panel>
    </FormLayout>
  );
}
