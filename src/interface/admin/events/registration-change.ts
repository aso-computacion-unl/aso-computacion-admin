import { registrationChangeImpacts, type EventRegistrationMode, type RegistrationChangeImpact } from "@/domain/event-registration";

/*
 * D14 (R8): what the admin is told before a save that changes the registration mode, or sets seats below the people
 * already registered. The same words reach the form's confirmation and the server's refusal of an unconfirmed save.
 * No server-only imports: the form is a client component.
 */
export interface RegistrationChangeWarning {
  /** "Este evento ya tiene N inscritos." */
  title: string;
  /** What will happen to those people, one sentence per change. */
  consequences: string[];
}

interface RegistrationChangeWords {
  registered: number;
  impacts: readonly RegistrationChangeImpact[];
  /** The mode and seats the save would leave in force; `capacity` `null` is no limit. */
  next: { mode: EventRegistrationMode; capacity: number | null };
}

const plural = (count: number, one: string, many: string) => `${count} ${count === 1 ? one : many}`;

function modeConsequence(mode: EventRegistrationMode): string {
  switch (mode) {
    case "none":
      return "Si quita la inscripción, esas inscripciones se conservan, pero el evento deja de aparecer en la lista de inscripciones y esas personas ya no recibirán el recordatorio.";
    case "unl":
      return "Si cambia a «Cuenta UNL», las personas ya inscritas conservan su cupo, pero desde ahora solo se podrá reservar con una cuenta institucional.";
    case "open":
      return "Si cambia a «Formulario abierto», las personas ya inscritas conservan su cupo, pero desde ahora cualquiera se inscribe con el formulario y confirma su correo.";
  }
}

export function registrationChangeWarning({ registered, impacts, next }: RegistrationChangeWords): RegistrationChangeWarning {
  const consequences: string[] = [];

  if (impacts.includes("mode")) {
    consequences.push(modeConsequence(next.mode));
  }

  if (impacts.includes("seats") && next.capacity !== null) {
    consequences.push(`Con ${plural(next.capacity, "cupo", "cupos")} el evento queda agotado: nadie pierde su cupo, pero no entrará nadie más hasta que se libere alguno.`);
  }

  return { title: `Este evento ya tiene ${plural(registered, "inscrito", "inscritos")}.`, consequences };
}

/** The server's refusal of a save that needs the confirmation and did not carry it. */
export function registrationChangeText(words: RegistrationChangeWords): string {
  const { title, consequences } = registrationChangeWarning(words);

  return [title, ...consequences, "Confirme el cambio para guardarlo."].join(" ");
}

/** The registration fields of the event form, as the text the admin typed. */
interface FormRegistration {
  registrationMode: EventRegistrationMode;
  registrationCapacity: string;
}

/** Seats as typed: blank is no limit; text that is not a number is not a limit yet (the field's own check will refuse it). */
function typedCapacity(text: string): number | null | undefined {
  const trimmed = text.trim();

  return trimmed === "" ? null : /^\d{1,4}$/.test(trimmed) ? Number(trimmed) : undefined;
}

/** Names the registration settings of a form (blank seats and the hidden seats of a form with no registration count the same): two forms with the same key save the same change. */
export function registrationChangeKey({ registrationMode, registrationCapacity }: FormRegistration): string {
  return `${registrationMode}|${registrationMode === "none" ? "" : registrationCapacity.trim()}`;
}

/**
 * What saving the form now would change for the registered people, judged against what is stored: the warning to show
 * (null when none) and a `key` that names this exact change, so a confirmation only covers the change it was given for.
 */
export function registrationChangeOfForm(registered: number, stored: FormRegistration, next: FormRegistration): { warning: RegistrationChangeWarning | null; key: string } {
  const capacity = typedCapacity(next.registrationCapacity);
  const impacts = registrationChangeImpacts({
    registered,
    current: { mode: stored.registrationMode, capacity: typedCapacity(stored.registrationCapacity) ?? null },
    next: { mode: next.registrationMode, capacity },
  });
  const key = registrationChangeKey(next);

  if (impacts.length === 0) {
    return { warning: null, key };
  }

  const effectiveCapacity = next.registrationMode === "none" ? null : capacity === undefined ? (typedCapacity(stored.registrationCapacity) ?? null) : capacity;

  return { warning: registrationChangeWarning({ registered, impacts, next: { mode: next.registrationMode, capacity: effectiveCapacity } }), key };
}
