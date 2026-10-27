import type { Testimonial, UpdateTestimonialInput } from "@/domain/testimonial";

import type { TestimonialResult } from "../dto/testimonial-result.dto";
import { toTestimonialResult } from "../mappers/testimonial-result.mapper";
import type { OrderedContentRepository } from "../ports/ordered-content-repository.port";
import { NotFoundError } from "./use-case-error";

export type UpdateTestimonialCommand = UpdateTestimonialInput & { id: string };

/** Text, publish flag and the alt of the current photo. Adding, replacing or removing the photo has its own use cases. */
export class UpdateTestimonialUseCase {
  constructor(private readonly testimonials: OrderedContentRepository<Testimonial>) {}

  async execute({ id, ...updates }: UpdateTestimonialCommand): Promise<TestimonialResult> {
    const testimonial = await this.testimonials.getById(id);

    if (!testimonial) {
      throw new NotFoundError("Testimonial not found");
    }

    return toTestimonialResult(await this.testimonials.update(testimonial.update(updates)));
  }
}
