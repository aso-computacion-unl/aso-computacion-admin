import { createNewsItem } from "@/interface/admin/news/actions";

import { FormLayout, Panel } from "../../_components/form-layout";
import { NewsForm } from "../_components/news-form";

export default function NewNewsPage() {
  return (
    <FormLayout
      backHref="/admin/news"
      backLabel="Volver a novedades"
      title="Nueva noticia"
      status="sin guardar"
      description="La foto de portada se agrega después de crear la noticia."
    >
      <Panel>
        <NewsForm action={createNewsItem} submitLabel="Crear noticia" />
      </Panel>
    </FormLayout>
  );
}
