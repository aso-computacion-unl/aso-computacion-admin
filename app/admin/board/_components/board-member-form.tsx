"use client";

import { useId, type ReactNode } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { SwitchField } from "@/components/ui/switch";
import type { ActionResult } from "@/interface/admin/action-result";

import { ActionBar, Field, FieldError, FormFeedback } from "../../_components/form-parts";
import { PUBLISHED_MESSAGE, PublishPreview, usePublishFlow } from "../../_components/publish-preview";
import { useControlledForm } from "../../_components/use-controlled-form";
import { BOARD_MEMBER_PUBLISH_FIELDS, BoardMemberPreview } from "./board-member-preview";

export interface BoardMemberFormValues {
  name: string;
  role: string;
  /** Alt of the member's current photo; the field shows only when `hasPhoto`, and a blank one is ignored without a photo. */
  photoAlt: string;
  isPublished: boolean;
}

export const EMPTY_BOARD_MEMBER_FORM_VALUES: BoardMemberFormValues = { name: "", role: "", photoAlt: "", isPublished: false };

interface BoardMemberFormProps {
  action: (prevState: ActionResult | null, formData: FormData) => Promise<ActionResult>;
  submitLabel: string;
  initialValues?: BoardMemberFormValues;
  /** An edit page of a draft: it saves by itself once the typing stops (never on a create page). */
  autosave?: boolean;
  hasPhoto?: boolean;
  /** The stored photo's address, so the preview before publishing shows it. */
  photoUrl?: string | null;
}

/**
 * One group of the form: an 18px heading with its purpose on the same line, then its fields on a 12-column grid
 * (dirección 02, as in the event editor). The grid starts at `@xl`, the width this one-column form reaches.
 */
function FormGroup({ title, purpose, children }: { title: string; purpose?: string; children: ReactNode }) {
  const id = useId();

  return (
    <section aria-labelledby={id} className="min-w-0">
      <div className="mb-4 flex flex-wrap items-baseline gap-x-3 gap-y-1">
        <h2 id={id} className="text-lg leading-[1.3] font-bold font-stretch-semi-expanded">
          {title}
        </h2>
        {purpose ? <span className="text-[0.8125rem] text-mist">{purpose}</span> : null}
      </div>
      <div className="grid gap-4 @xl:grid-cols-12">{children}</div>
    </section>
  );
}

// Only name, role and photo exist for a member: no contact data is collected (S4).
export function BoardMemberForm({ action, submitLabel, initialValues = EMPTY_BOARD_MEMBER_FORM_VALUES, autosave = false, hasPhoto = false, photoUrl = null }: BoardMemberFormProps) {
  const { values, stored, bind, toggle, handleSubmit, review, submit, state, isPending, errors, formRef, autosaveStatus } = useControlledForm(action, initialValues, { autosave });
  // A published member asks first, with the preview; a draft saves as it always did.
  const publishing = values.isPublished;
  const publish = usePublishFlow({ state, review, submit });
  const photoErrorId = `${useId()}-photo-error`;
  const photo = photoUrl ? { url: photoUrl } : null;

  return (
    <form ref={formRef} onSubmit={publishing ? publish.ask : handleSubmit} noValidate className="grid">
      <div className="grid gap-10">
        {/* Spans by data type: name and role are short text (6 + 6), the photo's description a full row. */}
        <FormGroup title="Contenido" purpose="Cómo aparece en la directiva">
          <Field label="Nombre" count={{ length: values.name.length, max: 60 }} error={errors.name} className="@xl:col-span-6">
            {(control) => <Input {...control} {...bind("name")} required maxLength={60} />}
          </Field>
          <Field label="Cargo" count={{ length: values.role.length, max: 60 }} error={errors.role} className="@xl:col-span-6">
            {(control) => <Input {...control} {...bind("role")} required maxLength={60} />}
          </Field>
          {hasPhoto ? (
            <Field label="Descripción de la foto" help="Para quien no ve la foto." count={{ length: values.photoAlt.length, max: 200 }} error={errors.photoAlt} className="@xl:col-span-12">
              {(control) => <Input {...control} {...bind("photoAlt")} required maxLength={200} />}
            </Field>
          ) : null}
        </FormGroup>
        <FormGroup title="Publicación">
          <div className="grid gap-1 @xl:col-span-12">
            <SwitchField
              label="Publicado"
              description={hasPhoto ? undefined : "Sin foto no se puede publicar: suba la foto primero."}
              {...toggle("isPublished")}
              aria-describedby={errors.photo ? photoErrorId : undefined}
              aria-invalid={errors.photo ? true : undefined}
            />
            {errors.photo ? <FieldError id={photoErrorId} announce={false}>{errors.photo}</FieldError> : null}
          </div>
        </FormGroup>
      </div>
      <ActionBar className="mt-6" status={<FormFeedback state={state} autosave={autosaveStatus} savedMessage={stored.isPublished ? PUBLISHED_MESSAGE : undefined} />}>
        <Button type="submit" busy={isPending} aria-disabled={isPending || undefined} className="min-h-12">
          {isPending ? "Guardando…" : publishing ? "Publicar" : submitLabel}
        </Button>
      </ActionBar>
      {publish.open ? (
        <PublishPreview
          before={stored.isPublished ? stored : null}
          after={values}
          fields={BOARD_MEMBER_PUBLISH_FIELDS}
          render={(shown, changed) => <BoardMemberPreview values={shown} photo={photo} changed={changed} />}
          {...publish.dialog}
        />
      ) : null}
    </form>
  );
}
