import { createNewsItem } from "@/interface/admin/news/actions";

import { FormHeader } from "../../_components/form-layout";
import { NewsForm } from "../_components/news-form";

export default function NewNewsPage() {
  return (
    <div>
      <FormHeader
        backHref="/admin/news"
        backLabel="Volver a novedades"
        title="Nueva noticia"
        status="sin guardar"
        description="Queda como borrador. La foto de portada, opcional, se sube al guardar, en la pantalla de edición: de al menos 1200 px de ancho."
      />
      <NewsForm action={createNewsItem} submitLabel="Crear noticia" />
    </div>
  );
}
