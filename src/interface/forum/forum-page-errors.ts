import { notFound } from "next/navigation";

import { NotFoundError } from "@/application";

/** A page read for something that is not there (unknown category, hidden or missing thread) is a 404, not a crash. */
export async function orNotFound<T>(read: Promise<T>): Promise<T> {
  try {
    return await read;
  } catch (error) {
    if (error instanceof NotFoundError) {
      notFound();
    }

    throw error;
  }
}
