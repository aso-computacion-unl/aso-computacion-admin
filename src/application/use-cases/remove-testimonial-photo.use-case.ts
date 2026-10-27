import type { Testimonial } from "@/domain/testimonial";

import type { TestimonialResult } from "../dto/testimonial-result.dto";
import { toTestimonialResult } from "../mappers/testimonial-result.mapper";
import type { MediaStoragePort } from "../ports/media-storage.port";
import type { OrderedContentRepository } from "../ports/ordered-content-repository.port";
import { destroyStoredImages } from "./destroy-stored-images";
import { NotFoundError } from "./use-case-error";

/**
 * Clears the photo (the testimonial keeps its publish flag: the photo is
 * optional), then destroys the stored file best effort, logging the
 * `publicId` when that fails. A testimonial without a photo is left as it is.
 */
export class RemoveTestimonialPhotoUseCase {
  constructor(
    private readonly testimonials: OrderedContentRepository<Testimonial>,
    private readonly storage: MediaStoragePort,
  ) {}

  async execute({ id }: { id: string }): Promise<TestimonialResult> {
    const testimonial = await this.testimonials.getById(id);

    if (!testimonial) {
      throw new NotFoundError("Testimonial not found");
    }

    const removed = testimonial.props.photo?.publicId;

    if (!removed) {
      return toTestimonialResult(testimonial);
    }

    const saved = await this.testimonials.update(testimonial.withoutPhoto());

    await destroyStoredImages(this.storage, [removed], `Removed the photo of testimonial "${id}"`);

    return toTestimonialResult(saved);
  }
}
