"use client";

import { removeSponsorLogo, uploadSponsorLogo } from "@/interface/admin/sponsors/actions";

import { SingleImagePanel, type StoredImage } from "../../_components/single-image-panel";

interface SponsorLogoPanelProps {
  sponsorId: string;
  logo: StoredImage | null;
}

export function SponsorLogoPanel({ sponsorId, logo }: SponsorLogoPanelProps) {
  return (
    <SingleImagePanel
      heading="Logo"
      subject="este aliado"
      image={logo}
      altField="logoAlt"
      upload={(formData) => uploadSponsorLogo(sponsorId, null, formData)}
      remove={() => removeSponsorLogo(sponsorId)}
      copy={{
        empty: "Este aliado no tiene logo.",
        add: "Agregar logo",
        replace: "Reemplazar logo",
        altLabel: "Descripción del logo nuevo",
        removeTrigger: "Quitar logo",
        removeWarning: "¿Quitar el logo? Si el aliado está publicado, pasa a borrador.",
        removeNote: "Se borra del almacenamiento y no se puede deshacer.",
        rules: "JPEG, PNG o WebP, hasta 5 MB, mínimo 200 px de ancho.",
        saved: "Logo guardado.",
        uploading: "Subiendo…",
        submitAdd: "Subir logo",
        submitReplace: "Reemplazar logo",
      }}
    />
  );
}
