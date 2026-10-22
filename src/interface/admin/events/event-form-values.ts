import type { EventResult } from "@/application";
import type { EventDatePrecision } from "@/domain/event";

/**
 * Editable text state of the event form. The form keeps these values in
 * React state and submits them by hand: React 19 empties uncontrolled fields
 * after a `<form action>` settles, which would wipe everything the owner
 * typed when a save fails.
 */
export interface EventFormValues {
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
}

export const EMPTY_EVENT_FORM_VALUES: EventFormValues = {
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
};

export function eventToFormValues(event: Omit<EventResult, "id" | "createdAt" | "updatedAt">): EventFormValues {
  return {
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
  };
}

export function formValuesToFormData(values: EventFormValues): FormData {
  const formData = new FormData();

  for (const [key, value] of Object.entries(values)) {
    if (typeof value === "boolean") {
      if (value) formData.set(key, "on");
    } else {
      formData.set(key, value);
    }
  }

  return formData;
}
