import { z } from "zod";

import { EVENT_REGISTRATION_CAPACITY_MAX, EVENT_REGISTRATION_MODES } from "@/domain/event-registration";

import { windowEnd } from "../publication-window-fields";

const CAPACITY_PATTERN = /^\d{1,4}$/;

/**
 * Seats as the number input sends them. Absent key: `undefined`, the use case keeps the current value.
 * Blank: `null`, unlimited. Anything but a whole number from 1 to the maximum is refused.
 */
const capacity = z
  .string()
  .optional()
  .transform((value, ctx) => {
    if (value === undefined) {
      return undefined;
    }

    if (value.trim() === "") {
      return null;
    }

    const seats = CAPACITY_PATTERN.test(value.trim()) ? Number(value.trim()) : Number.NaN;

    if (!(seats >= 1 && seats <= EVENT_REGISTRATION_CAPACITY_MAX)) {
      ctx.issues.push({ code: "custom", message: `Indique un número entero de 1 a ${EVENT_REGISTRATION_CAPACITY_MAX}.`, input: value });

      return z.NEVER;
    }

    return seats;
  });

/** Entries the event form spreads into its schema. All three are read only when the form sent them. */
export const registrationFormFields = {
  registrationMode: z.enum(EVENT_REGISTRATION_MODES, { error: "Elija una forma de inscripción de la lista." }).optional(),
  registrationCapacity: capacity,
  registrationDeadline: windowEnd("registrationDeadline"),
};
