"use client";

import { removeTestimonialPhoto, uploadTestimonialPhoto } from "@/interface/admin/testimonials/actions";

import { SingleImagePanel, type StoredImage } from "../../_components/single-image-panel";

interface TestimonialPhotoPanelProps {
  testimonialId: string;
  photo: StoredImage | null;
}

export function TestimonialPhotoPanel({ testimonialId, photo }: TestimonialPhotoPanelProps) {
  return (
    <SingleImagePanel
      heading="Foto (opcional)"
      subject="este testimonio"
      image={photo}
      altField="photoAlt"
      upload={(formData) => uploadTestimonialPhoto(testimonialId, null, formData)}
      remove={() => removeTestimonialPhoto(testimonialId)}
      copy={{
        empty: "Este testimonio no tiene foto. Se publica igual, solo con el texto.",
        add: "Elegir foto",
        replace: "Elegir otra foto",
        altLabel: "Descripción de la foto nueva",
        removeTrigger: "Quitar foto",
        removeWarning: "¿Quitar la foto? El testimonio sigue como está, sin foto.",
        removeNote: "Se borra del almacenamiento y no se puede deshacer.",
        rules: "JPEG, PNG o WebP, hasta 5 MB, mínimo 300 px de ancho.",
        saved: "Foto guardada.",
        uploading: "Subiendo…",
        submitAdd: "Subir foto",
        submitReplace: "Reemplazar foto",
      }}
    />
  );
}
