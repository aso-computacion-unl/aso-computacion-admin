import { z } from "zod";

import { formatEcuadorDateTime, parseEcuadorDateTime } from "@/domain/calendar-date";
import { ValidationError } from "@/domain/domain-error";

const INVALID_MESSAGE = "Indique una fecha y hora válidas.";

/**
 * One end of a publish window as a `datetime-local` input sends it (`YYYY-MM-DDTHH:mm`, Ecuador time).
 * Absent key: `undefined`, the use case keeps the current value. Blank: `null`, it clears that end.
 */
export function windowEnd(field: string) {
  return z
    .string()
    .optional()
    .transform((value, ctx) => {
      if (value === undefined) {
        return undefined;
      }

      if (value.trim() === "") {
        return null;
      }

      try {
        return parseEcuadorDateTime(field, value);
      } catch (error) {
        if (!(error instanceof ValidationError)) {
          throw error;
        }

        ctx.issues.push({ code: "custom", message: INVALID_MESSAGE, input: value });

        return z.NEVER;
      }
    });
}

/** The two schema entries both content forms spread in, so events and news read a window the same way. */
export const publicationWindowFields = { publishAt: windowEnd("publishAt"), unpublishAt: windowEnd("unpublishAt") };

/** The value a `datetime-local` input shows for a stored end: Ecuador wall-clock time, blank when there is none. */
export function windowEndToFormValue(end: Date | null): string {
  return end ? formatEcuadorDateTime(end) : "";
}
