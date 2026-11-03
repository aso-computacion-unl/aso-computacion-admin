"use client";

import { trashEvent } from "@/interface/admin/events/actions";
import { restoreTrashed } from "@/interface/admin/trash/actions";

import { DeleteButton } from "../../_components/row-actions";

interface EventDeleteButtonProps {
  eventId: string;
  title: string;
}

export function EventDeleteButton({ eventId, title }: EventDeleteButtonProps) {
  return (
    <DeleteButton
      label={title}
      warning="¿Mover este evento a la papelera? Sus fotos se conservan."
      action={() => trashEvent(eventId)}
      undo={() => restoreTrashed("event", eventId)}
    />
  );
}
