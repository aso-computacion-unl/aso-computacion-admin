import {
  CreateTestimonialUseCase,
  GetOrderedContentUseCase,
  ListOrderedContentUseCase,
  MoveOrderedContentUseCase,
  ReorderOrderedContentUseCase,
  RemoveTestimonialPhotoUseCase,
  SetOrderedContentPublishedUseCase,
  SetTestimonialPhotoUseCase,
  TrashContentUseCase,
  UpdateTestimonialUseCase,
  UploadImageUseCase,
} from "@/application";
import { toTestimonialResult } from "@/application/mappers/testimonial-result.mapper";
import { TestimonialPrismaRepository } from "@/infrastructure";
import { CloudinaryMediaStorage } from "@/infrastructure/storage/cloudinary-media-storage";
import { LazyMediaStorage } from "@/infrastructure/storage/lazy-media-storage";

const NOT_FOUND = "Testimonial not found";

function createTestimonialUseCases() {
  const testimonials = new TestimonialPrismaRepository();
  const storage = new LazyMediaStorage(() => new CloudinaryMediaStorage());

  return {
    list: new ListOrderedContentUseCase(testimonials, toTestimonialResult),
    get: new GetOrderedContentUseCase(testimonials, toTestimonialResult, NOT_FOUND),
    create: new CreateTestimonialUseCase(testimonials),
    update: new UpdateTestimonialUseCase(testimonials),
    setPublished: new SetOrderedContentPublishedUseCase(testimonials, toTestimonialResult, NOT_FOUND),
    trash: new TrashContentUseCase(testimonials, NOT_FOUND),
    move: new MoveOrderedContentUseCase(testimonials, NOT_FOUND),
    reorder: new ReorderOrderedContentUseCase(testimonials, NOT_FOUND),
    setPhoto: new SetTestimonialPhotoUseCase(testimonials, new UploadImageUseCase(storage), storage),
    removePhoto: new RemoveTestimonialPhotoUseCase(testimonials, storage),
  };
}

let useCases: ReturnType<typeof createTestimonialUseCases> | undefined;

/**
 * Built on first use, not at import time: the Cloudinary adapter reads its
 * credentials in the constructor, and a build that merely imports the actions
 * must not need them.
 */
export function getTestimonialUseCases() {
  useCases ??= createTestimonialUseCases();
  return useCases;
}
