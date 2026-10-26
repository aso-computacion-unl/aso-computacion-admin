"use client";

import { trashEvent } from "@/interface/admin/events/actions";

import { DeleteButton } from "../../_components/row-actions";

interface EventDeleteButtonProps {
  eventId: string;
  title: string;
}

export function EventDeleteButton({ eventId, title }: EventDeleteButtonProps) {
  return <DeleteButton label={title} warning="¿Eliminar este evento y sus fotos?" action={() => trashEvent(eventId)} />;
}
