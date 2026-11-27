import type { EventResult } from "@/application";
import type { EventDatePrecision } from "@/domain/event";

import { windowEndToFormValue } from "../publication-window-fields";

/**
 * Editable text state of the event form. The form keeps these values in
 * React state and submits them by hand: React 19 empties uncontrolled fields
 * after a `<form action>` settles, which would wipe everything the owner
 * typed when a save fails. The kind and its registration settings are only sent when a new event is created as
 * «Evento con inscripción»: an event save never changes them.
 */
export interface EventFormValues {
  /** The kind a new event is created as (event-kinds S2). */
  eventKind: "announcement" | "registration";
  registrationMode: "unl" | "open";
  /** Whole seats as typed, or blank for no limit. */
  registrationCapacity: string;
  /** `YYYY-MM-DDTHH:mm` in Ecuador time, or blank: it closes when the event's day is over. */
  registrationDeadline: string;
  title: string;
  slug: string;
  description: string;
  /** YYYY-MM-DD; with `datePrecision` "month" it is the first of the month. */
  date: string;
  datePrecision: EventDatePrecision;
  type: string;
  commitMessage: string;
  hora: string;
  lugar: string;
  para: string;
  featured: boolean;
  linkUrl: string;
  linkLabel: string;
  /** One highlight per line. */
  highlights: string;
  isPublished: boolean;
  /** `YYYY-MM-DDTHH:mm` in Ecuador time, or blank for no start. */
  publishAt: string;
  /** `YYYY-MM-DDTHH:mm` in Ecuador time, or blank for no end. */
  unpublishAt: string;
}

export const EMPTY_EVENT_FORM_VALUES: EventFormValues = {
  eventKind: "announcement",
  registrationMode: "unl",
  registrationCapacity: "",
  registrationDeadline: "",
  title: "",
  slug: "",
  description: "",
  date: "",
  datePrecision: "day",
  type: "",
  commitMessage: "",
  hora: "",
  lugar: "",
  para: "",
  featured: false,
  linkUrl: "",
  linkLabel: "",
  highlights: "",
  isPublished: false,
  publishAt: "",
  unpublishAt: "",
};

/** The registration keys a save sends only for «Evento con inscripción». */
const REGISTRATION_KEYS = new Set(["eventKind", "registrationMode", "registrationCapacity", "registrationDeadline"]);

export function eventToFormValues(event: Omit<EventResult, "id" | "createdAt" | "updatedAt">): EventFormValues {
  return {
    // An existing event's kind is fixed: its form never sends one.
    eventKind: "announcement",
    registrationMode: "unl",
    registrationCapacity: "",
    registrationDeadline: "",
    title: event.title,
    slug: event.slug,
    description: event.description ?? "",
    date: event.date ?? "",
    datePrecision: event.datePrecision,
    type: event.type ?? "",
    commitMessage: event.commitMessage ?? "",
    hora: event.hora ?? "",
    lugar: event.lugar ?? "",
    para: event.para ?? "",
    featured: event.featured,
    linkUrl: event.linkUrl ?? "",
    linkLabel: event.linkLabel ?? "",
    highlights: event.highlights.join("\n"),
    isPublished: event.isPublished,
    publishAt: windowEndToFormValue(event.publishAt),
    unpublishAt: windowEndToFormValue(event.unpublishAt),
  };
}

export function formValuesToFormData(values: EventFormValues): FormData {
  const formData = new FormData();

  for (const [key, value] of Object.entries(values)) {
    if (REGISTRATION_KEYS.has(key) && values.eventKind !== "registration") {
      continue;
    }

    if (typeof value === "boolean") {
      if (value) formData.set(key, "on");
    } else {
      formData.set(key, value);
    }
  }

  return formData;
}
