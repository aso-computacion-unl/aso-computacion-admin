import "server-only";

import { NotFoundError } from "@/application";

import { requirePageSession } from "../../auth/require-page-session";
import { getTestimonialUseCases } from "./testimonials-container";

/** Admin list: every testimonial, drafts included, in display order. */
export async function getAdminTestimonials() {
  await requirePageSession();
  return getTestimonialUseCases().list.execute();
}

/** One testimonial, or null when it does not exist. */
export async function getAdminTestimonial(id: string) {
  await requirePageSession();
  try {
    return await getTestimonialUseCases().get.execute({ id });
  } catch (error) {
    if (error instanceof NotFoundError) return null;
    throw error;
  }
}
