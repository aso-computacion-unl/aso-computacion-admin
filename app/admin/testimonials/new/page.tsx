import { createTestimonial } from "@/interface/admin/testimonials/actions";

import { AsideNote, FormPage, Panel } from "../../_components/page-head";
import { TestimonialForm } from "../_components/testimonial-form";

export default function NewTestimonialPage() {
  return (
    <FormPage
      backHref="/admin/testimonials"
      backLabel="Volver a los testimonios"
      title="Nuevo testimonio"
      meta="Se agrega al final de la lista. La foto es opcional y se sube en el paso siguiente."
      aside={<AsideNote title="Foto">Se sube al guardar el testimonio, en la pantalla de edición. No es necesaria para publicar.</AsideNote>}
    >
      <Panel>
        <TestimonialForm action={createTestimonial} submitLabel="Crear testimonio" />
      </Panel>
    </FormPage>
  );
}
