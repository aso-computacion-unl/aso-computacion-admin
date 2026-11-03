import { Testimonial, type CreateTestimonialInput } from "@/domain/testimonial";

import type { TestimonialResult } from "../dto/testimonial-result.dto";
import { toTestimonialResult } from "../mappers/testimonial-result.mapper";
import type { OrderedContentRepository } from "../ports/ordered-content-repository.port";
import { nextSortOrder } from "./ordered-content.use-cases";

export type CreateTestimonialCommand = Pick<CreateTestimonialInput, "quote" | "name" | "role" | "isPublished">;

/**
 * New testimonials go to the end of the list, without a photo: the optional
 * photo is added afterwards with `SetTestimonialPhotoUseCase`, once the
 * testimonial has an id.
 */
export class CreateTestimonialUseCase {
  constructor(private readonly testimonials: OrderedContentRepository<Testimonial>) {}

  async execute({ quote, name, role, isPublished }: CreateTestimonialCommand): Promise<TestimonialResult> {
    const sortOrder = nextSortOrder(await this.testimonials.list());

    return toTestimonialResult(await this.testimonials.create(Testimonial.create({ quote, name, role, isPublished, sortOrder })));
  }
}
