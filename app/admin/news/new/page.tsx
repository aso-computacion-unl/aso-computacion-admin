import { createNewsItem } from "@/interface/admin/news/actions";

import { AsideNote, FormFrame } from "../../_components/page-head";
import { NewsForm } from "../_components/news-form";

export default function NewNewsPage() {
  return (
    <FormFrame backHref="/admin/news" backLabel="Volver a novedades" title="Nueva noticia" meta="Queda como borrador. La foto de portada, opcional, se sube en el paso siguiente.">
      <NewsForm
        action={createNewsItem}
        submitLabel="Crear noticia"
        asideTop={<AsideNote title="Foto de portada">Opcional. Se agrega al guardar la noticia, en la pantalla de edición: de al menos 1200 px de ancho.</AsideNote>}
      />
    </FormFrame>
  );
}
