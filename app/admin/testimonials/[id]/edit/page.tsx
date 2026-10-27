import { notFound } from "next/navigation";

import { updateTestimonial } from "@/interface/admin/testimonials/actions";
import { getAdminTestimonial } from "@/interface/admin/testimonials/testimonials-admin-read";

import { recordStatus } from "../../../_components/page-header";
import { FormPage, Panel } from "../../../_components/page-head";
import { TestimonialForm } from "../../_components/testimonial-form";
import { TestimonialPhotoPanel } from "../../_components/testimonial-photo-panel";

export const dynamic = "force-dynamic";

interface EditTestimonialPageProps {
  params: Promise<{ id: string }>;
}

export default async function EditTestimonialPage({ params }: EditTestimonialPageProps) {
  const { id } = await params;
  const testimonial = await getAdminTestimonial(id);

  if (!testimonial) notFound();

  return (
    <FormPage
      backHref="/admin/testimonials"
      backLabel="Volver a los testimonios"
      title="Editar testimonio"
      status={recordStatus(testimonial.name, testimonial.isPublished, "m")}
      aside={<TestimonialPhotoPanel key={testimonial.photo?.url ?? "no-photo"} testimonialId={id} photo={testimonial.photo} />}
    >
      {/* Keyed by the photo so the alt field and the panel start fresh after a replace or remove. */}
      <Panel>
        <TestimonialForm
          key={testimonial.photo?.url ?? "no-photo"}
          action={updateTestimonial.bind(null, id)}
          submitLabel="Guardar cambios"
          hasPhoto={testimonial.photo !== null}
          initialValues={{
            quote: testimonial.quote,
            name: testimonial.name,
            role: testimonial.role,
            photoAlt: testimonial.photo?.alt ?? "",
            isPublished: testimonial.isPublished,
          }}
        />
      </Panel>
    </FormPage>
  );
}
