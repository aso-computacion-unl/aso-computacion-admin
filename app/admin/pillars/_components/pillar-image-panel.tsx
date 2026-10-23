"use client";

import { removePillarImage, uploadPillarImage } from "@/interface/admin/pillars/actions";

import { SingleImagePanel, type StoredImage } from "../../_components/single-image-panel";

interface PillarImagePanelProps {
  pillarId: string;
  image: StoredImage | null;
}

export function PillarImagePanel({ pillarId, image }: PillarImagePanelProps) {
  return (
    <SingleImagePanel
      heading="Imagen"
      subject="este pilar"
      image={image}
      altField="imageAlt"
      upload={(formData) => uploadPillarImage(pillarId, null, formData)}
      remove={() => removePillarImage(pillarId)}
      copy={{
        empty: "Este pilar no tiene imagen.",
        add: "Agregar imagen",
        replace: "Reemplazar imagen",
        altLabel: "Descripción de la imagen nueva",
        removeTrigger: "Quitar imagen",
        removeWarning: "¿Quitar la imagen?",
        removeNote: "Se borra del almacenamiento y no se puede deshacer.",
        rules: "JPEG, PNG o WebP, hasta 5 MB, mínimo 1200 px de ancho.",
        saved: "Imagen guardada.",
        uploading: "Subiendo…",
        submitAdd: "Subir imagen",
        submitReplace: "Reemplazar imagen",
      }}
    />
  );
}
