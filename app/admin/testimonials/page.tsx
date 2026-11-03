import Link from "next/link";

import { Icon } from "@/components/icons";
import { Button } from "@/components/ui/button";
import { thumbnailUrl } from "@/lib/cloudinary-thumbnail";
import { moveTestimonial, setTestimonialPublished, trashTestimonial } from "@/interface/admin/testimonials/actions";
import { getAdminTestimonials } from "@/interface/admin/testimonials/testimonials-admin-read";
import { publicationSummary } from "@/interface/admin/publication-summary";
import { restoreTrashed } from "@/interface/admin/trash/actions";

import { OrderedRow } from "../_components/ordered-row";
import { PageHead } from "../_components/page-head";
import { MoveButtons, PublishedToggle, TrashButton } from "../_components/row-actions";
import { EmptyState, OrderedList } from "../_components/timeline-parts";

// Reads mutable data on every request.
export const dynamic = "force-dynamic";

export default async function AdminTestimonialsPage() {
  const testimonials = await getAdminTestimonials();

  return (
    <div>
      <PageHead
        title="Testimonios"
        meta={`main · ${publicationSummary(testimonials)}`}
        action={
          <Button asChild className="min-h-12 flex-none">
            <Link href="/admin/testimonials/new">
              <Icon name="plus" />
              Nuevo testimonio
            </Link>
          </Button>
        }
      />
      {testimonials.length === 0 ? (
        <EmptyState
          action={
            <Button asChild>
              <Link href="/admin/testimonials/new">
                <Icon name="plus" />
                Agregar el primer testimonio
              </Link>
            </Button>
          }
        >
          Todavía no hay testimonios. Cada uno lleva una cita, el nombre y el cargo de quien la dijo, y una foto opcional.
        </EmptyState>
      ) : (
        <OrderedList label="Testimonios, en el orden en que se muestran">
          {testimonials.map((testimonial, index) => (
            <OrderedRow
              key={testimonial.id}
              published={testimonial.isPublished}
              position={index + 1}
              label={testimonial.name}
              editHref={`/admin/testimonials/${testimonial.id}/edit`}
              media={
                testimonial.photo ? (
                  // Remote Cloudinary asset, requested at thumbnail size; a plain <img> is enough in the admin.
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={thumbnailUrl(testimonial.photo.url, 64, 64)} alt="" loading="lazy" decoding="async" width={64} height={64} className="size-16 shrink-0 rounded-full object-cover" />
                ) : (
                  <span aria-hidden="true" className="grid size-16 shrink-0 place-items-center rounded-full border border-dashed border-mist/60 text-mist">
                    <Icon name="news" />
                  </span>
                )
              }
              toggle={<PublishedToggle label={testimonial.name} isPublished={testimonial.isPublished} action={setTestimonialPublished.bind(null, testimonial.id)} />}
              move={
                <MoveButtons
                  label={testimonial.name}
                  isFirst={index === 0}
                  isLast={index === testimonials.length - 1}
                  position={index + 1}
                  total={testimonials.length}
                  action={moveTestimonial.bind(null, testimonial.id)}
                />
              }
              remove={
                <TrashButton label={testimonial.name} warning="¿Mover este testimonio a la papelera?" action={trashTestimonial.bind(null, testimonial.id)} undo={restoreTrashed.bind(null, "testimonial", testimonial.id)} />
              }
            >
              <h2 className="font-display text-lg leading-tight wrap-anywhere">
                <Link href={`/admin/testimonials/${testimonial.id}/edit`} className="rounded-xs underline-offset-4 hover:underline">
                  {testimonial.name}
                </Link>
              </h2>
              <p className="text-sm text-mist">{testimonial.role}</p>
              <p className="line-clamp-2 text-sm wrap-anywhere">«{testimonial.quote}»</p>
            </OrderedRow>
          ))}
        </OrderedList>
      )}
    </div>
  );
}
