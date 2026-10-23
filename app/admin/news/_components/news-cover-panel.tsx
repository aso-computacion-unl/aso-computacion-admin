"use client";

import { removeNewsCover, uploadNewsCover } from "@/interface/admin/news/actions";

import { SingleImagePanel, type StoredImage } from "../../_components/single-image-panel";

interface NewsCoverPanelProps {
  newsId: string;
  cover: StoredImage | null;
}

export function NewsCoverPanel({ newsId, cover }: NewsCoverPanelProps) {
  return (
    <SingleImagePanel
      heading="Foto de portada"
      subject="esta noticia"
      image={cover}
      altField="coverAlt"
      upload={(formData) => uploadNewsCover(newsId, null, formData)}
      remove={() => removeNewsCover(newsId)}
      copy={{
        empty: "Esta noticia no tiene foto de portada. Es opcional.",
        add: "Agregar foto de portada",
        replace: "Reemplazar foto de portada",
        altLabel: "Descripción de la foto nueva",
        removeTrigger: "Quitar portada",
        removeWarning: "¿Quitar la foto de portada?",
        removeNote: "Se borra del almacenamiento y no se puede deshacer.",
        rules: "JPEG, PNG o WebP, hasta 5 MB, mínimo 1200 px de ancho.",
        saved: "Portada guardada.",
        uploading: "Subiendo…",
        submitAdd: "Subir portada",
        submitReplace: "Reemplazar portada",
      }}
    />
  );
}
