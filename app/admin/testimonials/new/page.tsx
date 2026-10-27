import { createTestimonial } from "@/interface/admin/testimonials/actions";

import { FormLayout, Panel } from "../../_components/form-layout";
import { TestimonialForm } from "../_components/testimonial-form";

export default function NewTestimonialPage() {
  return (
    <FormLayout
      backHref="/admin/testimonials"
      backLabel="Volver a los testimonios"
      title="Nuevo testimonio"
      status="sin guardar"
      description="Se agrega al final de la lista. La foto es opcional y se sube en el paso siguiente."
    >
      <Panel>
        <TestimonialForm action={createTestimonial} submitLabel="Crear testimonio" />
      </Panel>
    </FormLayout>
  );
}
