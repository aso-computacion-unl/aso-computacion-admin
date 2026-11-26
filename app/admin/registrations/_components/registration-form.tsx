"use client";

import { useRef, useState, type FormEvent } from "react";

import { Button } from "@/components/ui/button";
import type { EventRegistrationMode } from "@/domain/event-registration";
import type { ActionResult } from "@/interface/admin/action-result";
import { registrationChangeKey, registrationChangeOfForm } from "@/interface/admin/events/registration-change";

import { ActionBar, FormFeedback } from "../../_components/form-parts";
import { useControlledForm } from "../../_components/use-controlled-form";
import { RegistrationChangeDialog } from "../../events/_components/registration-change-dialog";
import { RegistrationFields } from "../../events/_components/registration-fields";

type RegistrationFormAction = (prevState: ActionResult | null, formData: FormData) => Promise<ActionResult>;

/** The registration settings of an event, as typed: the only fields this form sends. */
export interface RegistrationFormValues {
  registrationMode: EventRegistrationMode;
  /** Seats as typed; blank is unlimited. */
  registrationCapacity: string;
  /** `YYYY-MM-DDTHH:mm` in Ecuador time, or blank for no deadline. */
  registrationDeadline: string;
}

interface RegistrationFormProps {
  action: RegistrationFormAction;
  initialValues: RegistrationFormValues;
  submitLabel: string;
  /** People registered and confirmed in this event: changing its mode, or its seats below this number, asks first (D14). */
  registeredCount?: number;
}

/** The field the server requires for a change that affects the registered people. Same name as the server's. */
const REGISTRATION_CHANGE_CONFIRMED_FIELD = "confirmRegistrationChange";

/**
 * The registration of one event, set from the Inscripciones area: mode, seats and deadline, nothing else of the event.
 * Saved by its button only (no autosave). A change that affects people already registered asks first, as in R8/D14.
 */
export function RegistrationForm({ action, initialValues, submitLabel, registeredCount = 0 }: RegistrationFormProps) {
  // The change the admin accepted in the question, by its `key`: only that exact change travels with the confirmation.
  const confirmedChange = useRef<string | null>(null);
  const [asking, setAsking] = useState<string | null>(null);
  const { values, stored, setValues, bind, handleSubmit, review, state, isPending, errors, formRef } = useControlledForm(action, initialValues, {
    serialize: (current) => {
      const formData = new FormData();

      for (const [key, value] of Object.entries(current)) formData.set(key, value);
      if (confirmedChange.current !== null && confirmedChange.current === registrationChangeKey(current)) {
        formData.set(REGISTRATION_CHANGE_CONFIRMED_FIELD, "on");
      }

      return formData;
    },
  });
  const change = registrationChangeOfForm(registeredCount, stored, values);

  function handleFormSubmit(event: FormEvent<HTMLFormElement>) {
    if (change.warning && confirmedChange.current !== change.key) {
      if (review(event)) setAsking(change.key);

      return;
    }

    handleSubmit(event);
  }

  function confirmChange() {
    confirmedChange.current = change.key;
    setAsking(null);
    formRef.current?.requestSubmit();
  }

  return (
    <form ref={formRef} onSubmit={handleFormSubmit} noValidate>
      <div className="grid gap-x-4 gap-y-5 @xl:grid-cols-2">
        <RegistrationFields
          mode={values.registrationMode}
          onModeChange={(registrationMode) => setValues((previous) => ({ ...previous, registrationMode }))}
          capacity={bind("registrationCapacity")}
          deadline={bind("registrationDeadline")}
          errors={errors}
        />
      </div>

      {asking === change.key && change.warning ? <RegistrationChangeDialog warning={change.warning} onConfirm={confirmChange} onKeepEditing={() => setAsking(null)} /> : null}
      <ActionBar status={<FormFeedback state={state} />}>
        <Button type="submit" busy={isPending} aria-disabled={isPending || undefined} className="min-h-12">
          {isPending ? "Guardando…" : submitLabel}
        </Button>
      </ActionBar>
    </form>
  );
}
