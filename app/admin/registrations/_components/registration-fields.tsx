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
  /** The mode group's legend; the event editor names it under its own «Inscripción» heading. */
  legend?: string;
}

const MODE_OPTIONS = [
  { value: "unl", label: "Cuenta UNL" },
  { value: "open", label: "Formulario abierto" },
] as const satisfies readonly { value: EventRegistrationMode; label: string }[];

/** How people sign up, with an optional seat limit and deadline (Ecuador time): the settings of an event with registration. */
export function RegistrationSettingsFields({ id, mode, onModeChange, capacity, deadline, errors, legend = "Inscripción" }: RegistrationFieldsProps & { id?: string }) {
  return (
    <div id={id} className="grid min-w-0 gap-x-4 gap-y-5 @xl:col-span-2 @xl:grid-cols-2">
      <div className="grid min-w-0 content-start gap-1.5 @xl:col-span-2">
        <Segmented
          legend={legend}
          name="registrationMode"
          value={mode}
          options={MODE_OPTIONS}
          columnsClassName="grid-cols-1 sm:grid-cols-2"
          onChange={(value) => onModeChange(value as EventRegistrationMode)}
          aria-describedby={errors.registrationMode ? "registrationMode-error" : undefined}
          aria-invalid={errors.registrationMode ? true : undefined}
        />
        {errors.registrationMode ? <FieldError id="registrationMode-error">{errors.registrationMode}</FieldError> : null}
      </div>
      <Field label="Cupos" help="Vacío: sin límite." error={errors.registrationCapacity}>
        {(control) => <Input {...control} {...capacity} type="number" inputMode="numeric" min={1} max={5000} step={1} />}
      </Field>
      <Field label="Cierre" help="Hora de Ecuador. Vacío: se cierra cuando pasa el día del evento." error={errors.registrationDeadline}>
        {(control) => <Input {...control} {...deadline} type="datetime-local" />}
      </Field>
    </div>
  );
}
