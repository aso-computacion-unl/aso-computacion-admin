"use client";

import { removeBoardMemberPhoto, uploadBoardMemberPhoto } from "@/interface/admin/board/actions";

import { SingleImagePanel, type StoredImage } from "../../_components/single-image-panel";

interface BoardMemberPhotoPanelProps {
  memberId: string;
  photo: StoredImage | null;
}

export function BoardMemberPhotoPanel({ memberId, photo }: BoardMemberPhotoPanelProps) {
  return (
    <SingleImagePanel
      heading="Foto"
      subject="este integrante"
      image={photo}
      altField="photoAlt"
      upload={(formData) => uploadBoardMemberPhoto(memberId, null, formData)}
      remove={() => removeBoardMemberPhoto(memberId)}
      copy={{
        empty: "Este integrante no tiene foto.",
        add: "Agregar foto",
        replace: "Reemplazar foto",
        altLabel: "Descripción de la foto nueva",
        removeTrigger: "Quitar foto",
        removeWarning: "¿Quitar la foto? Si el integrante está publicado, pasa a borrador.",
        removeNote: "Se borra del almacenamiento y no se puede deshacer.",
        rules: "JPEG, PNG o WebP, hasta 5 MB, mínimo 577 px de ancho.",
        saved: "Foto guardada.",
        uploading: "Subiendo…",
        submitAdd: "Subir foto",
        submitReplace: "Reemplazar foto",
      }}
    />
  );
}
