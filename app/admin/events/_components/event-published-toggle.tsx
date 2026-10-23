"use client";

import { setEventPublished } from "@/interface/admin/events/actions";

import { PublishedToggle } from "../../_components/row-actions";

interface EventPublishedToggleProps {
  eventId: string;
  title: string;
  isPublished: boolean;
}

export function EventPublishedToggle({ eventId, title, isPublished }: EventPublishedToggleProps) {
  return <PublishedToggle label={title} isPublished={isPublished} action={(next) => setEventPublished(eventId, next)} />;
}
