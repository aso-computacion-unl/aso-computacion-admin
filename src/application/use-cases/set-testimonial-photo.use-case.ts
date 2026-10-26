import { assertTestimonialPhotoAlt, type Testimonial } from "@/domain/testimonial";

import type { TestimonialResult } from "../dto/testimonial-result.dto";
import { toTestimonialResult } from "../mappers/testimonial-result.mapper";
import type { ImageUploadFile, MediaStoragePort } from "../ports/media-storage.port";
import type { OrderedContentRepository } from "../ports/ordered-content-repository.port";
import { destroyStoredImages } from "./destroy-stored-images";
import { NotFoundError } from "./use-case-error";
import type { UploadImageUseCase } from "./upload-image.use-case";

export const TESTIMONIAL_PHOTO_FOLDER = "testimonials";
/** A portrait is shown small; 300 px keeps it sharp on a retina card without asking for a studio photo. */
export const TESTIMONIAL_PHOTO_MIN_WIDTH = 300;

export interface SetTestimonialPhotoCommand {
  id: string;
  file: ImageUploadFile;
  alt: string;
}

/**
 * Adds or replaces a testimonial's photo.
 *
 * What can be checked without storage (alt text, the testimonial exists) is
 * checked BEFORE the upload. The DB write comes last: when it fails, the new
 * asset is nobody's, so it is destroyed (best effort, logged) and the original
 * error is rethrown. When it succeeds, the replaced photo is destroyed best
 * effort, logging any `publicId` left behind.
 */
export class SetTestimonialPhotoUseCase {
  constructor(
    private readonly testimonials: OrderedContentRepository<Testimonial>,
    private readonly uploadImage: UploadImageUseCase,
    private readonly storage: MediaStoragePort,
  ) {}

  async execute({ id, file, alt }: SetTestimonialPhotoCommand): Promise<TestimonialResult> {
    const validAlt = assertTestimonialPhotoAlt(alt);
    const testimonial = await this.testimonials.getById(id);

    if (!testimonial) {
      throw new NotFoundError("Testimonial not found");
    }

    const asset = await this.uploadImage.execute({
      file,
      folder: TESTIMONIAL_PHOTO_FOLDER,
      minWidth: TESTIMONIAL_PHOTO_MIN_WIDTH,
    });

    let saved: Testimonial;

    try {
      saved = await this.testimonials.update(testimonial.withPhoto({ ...asset, alt: validAlt }));
    } catch (error) {
      await destroyStoredImages(this.storage, [asset.publicId], `Could not save testimonial "${id}" after uploading its photo`);
      throw error;
    }

    const replaced = testimonial.props.photo?.publicId;

    if (replaced) {
      await destroyStoredImages(this.storage, [replaced], `Replaced the photo of testimonial "${id}"`);
    }

    return toTestimonialResult(saved);
  }
}
