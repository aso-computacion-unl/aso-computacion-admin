import type { Testimonial } from "@/domain/testimonial";

import type { TestimonialResult } from "../dto/testimonial-result.dto";

export function toTestimonialResult({ props }: Testimonial): TestimonialResult {
  const { photo } = props;

  return {
    id: props.id,
    quote: props.quote,
    name: props.name,
    role: props.role,
    photo: photo && { url: photo.url, width: photo.width, height: photo.height, alt: photo.alt },
    sortOrder: props.sortOrder,
    isPublished: props.isPublished,
    createdAt: props.createdAt,
    updatedAt: props.updatedAt,
  };
}
