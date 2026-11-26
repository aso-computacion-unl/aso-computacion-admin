import { createNewsItem } from "@/interface/admin/news/actions";

import { FormLayout } from "../../_components/form-layout";
import { NewsForm } from "../_components/news-form";

export default function NewNewsPage() {
  return (
    <FormLayout backHref="/admin/news" backLabel="Volver a novedades" title="Nueva noticia" status="sin guardar" wide>
      <NewsForm action={createNewsItem} submitLabel="Crear noticia" />
    </FormLayout>
  );
}
