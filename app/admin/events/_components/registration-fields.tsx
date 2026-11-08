import { useId, useState } from "react";

import { Input } from "@/components/ui/input";
import { Segmented } from "@/components/ui/segmented";
import { SwitchField } from "@/components/ui/switch";
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
  { value: "unl", label: "Cuenta UNL" },
  { value: "open", label: "Formulario abierto" },
] as const satisfies readonly { value: EventRegistrationMode; label: string }[];

/** One switch: off is mode `none`; on asks how people sign up, with an optional seat limit and deadline (Ecuador time). */
export function RegistrationFields({ mode, onModeChange, capacity, deadline, errors }: RegistrationFieldsProps) {
  const panelId = useId();
  const on = mode !== "none";
  // Turning the switch back on returns to the way the event signed people up before.
  const [lastMode, setLastMode] = useState<EventRegistrationMode>(on ? mode : "unl");

  function chooseMode(value: EventRegistrationMode) {
    setLastMode(value);
    onModeChange(value);
  }

  return (
    <>
      <SwitchField
        label="Tiene inscripción"
        checked={on}
        aria-controls={on ? panelId : undefined}
        onChange={() => onModeChange(on ? "none" : lastMode)}
        className="@xl:col-span-2"
      />
      {on ? (
        <div id={panelId} className="grid min-w-0 gap-x-4 gap-y-5 @xl:col-span-2 @xl:grid-cols-2">
          <div className="grid min-w-0 content-start gap-1.5 @xl:col-span-2">
            <Segmented
              legend="Inscripción"
              name="registrationMode"
              value={mode}
              options={MODE_OPTIONS}
              columnsClassName="grid-cols-1 sm:grid-cols-2"
              onChange={(value) => chooseMode(value as EventRegistrationMode)}
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
      ) : null}
    </>
  );
}
