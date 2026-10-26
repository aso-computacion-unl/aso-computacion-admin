import { Input } from "@/components/ui/input";
import { Segmented } from "@/components/ui/segmented";
import type { EventRegistrationMode } from "@/domain/event-registration";

import { Field, FieldError } from "../../_components/form-parts";

type Bound = { name: string; value: string; onChange: (event: { target: { value: string } }) => void };

interface RegistrationFieldsProps {
  mode: EventRegistrationMode;
  onModeChange: (mode: EventRegistrationMode) => void;
  /** `bind("registrationCapacity")` and `bind("registrationDeadline")` of the form that owns the values. */
  capacity: Bound;
  deadline: Bound;
  errors: Record<string, string | undefined>;
}

const MODE_OPTIONS = [
  { value: "none", label: "Sin inscripción" },
  { value: "unl", label: "Cuenta UNL" },
  { value: "open", label: "Formulario abierto" },
] as const satisfies readonly { value: EventRegistrationMode; label: string }[];

const MODE_HINTS: Record<EventRegistrationMode, string> = {
  none: "El evento no recibe inscripciones.",
  unl: "La persona entra con su cuenta de Google @unl.edu.ec: el nombre y el correo vienen verificados y solo puede inscribirse una vez.",
  open: "Cualquier persona completa nombre, correo, carrera y ciclo, con verificación antispam. El correo no se verifica.",
};

/** How people sign up for the event, with an optional seat limit and deadline (Ecuador time). */
export function RegistrationFields({ mode, onModeChange, capacity, deadline, errors }: RegistrationFieldsProps) {
  return (
    <>
      <div className="grid min-w-0 content-start gap-1.5 @xl:col-span-2">
        <Segmented
          legend="Inscripción"
          name="registrationMode"
          value={mode}
          options={MODE_OPTIONS}
          columnsClassName="grid-cols-1 sm:grid-cols-3"
          onChange={(value) => onModeChange(value as EventRegistrationMode)}
          aria-describedby="registrationMode-hint"
          aria-invalid={errors.registrationMode ? true : undefined}
        />
        <p id="registrationMode-hint" className="text-sm text-mist">
          {MODE_HINTS[mode]}
        </p>
        {errors.registrationMode ? <FieldError id="registrationMode-error">{errors.registrationMode}</FieldError> : null}
      </div>
      {mode === "none" ? null : (
        <>
          <Field label="Cupos" hint="Vacío: sin límite. Al llegar al límite se cierran las inscripciones." error={errors.registrationCapacity}>
            {(control) => <Input {...control} {...capacity} type="number" inputMode="numeric" min={1} max={5000} step={1} />}
          </Field>
          <Field
            label="Inscripciones hasta"
            hint="Hora de Ecuador. Vacío: se cierran cuando pasa el día del evento."
            error={errors.registrationDeadline}
          >
            {(control) => <Input {...control} {...deadline} type="datetime-local" />}
          </Field>
        </>
      )}
    </>
  );
}
