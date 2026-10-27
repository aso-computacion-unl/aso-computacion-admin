import { DeleteOrphanImagesUseCase, FindOrphanImagesUseCase, ListMediaLibraryUseCase } from "@/application";
import { MediaUsagePrismaReader } from "@/infrastructure/repositories/media-usage-prisma.reader";
import { CloudinaryMediaLibrary } from "@/infrastructure/storage/cloudinary-media-library";
import { CloudinaryMediaStorage } from "@/infrastructure/storage/cloudinary-media-storage";

/**
 * Built on each read, not at import time: the Cloudinary adapters read their credentials in the
 * constructor, and a build that merely imports the page must not need them. A failed build is
 * not cached, so a fixed configuration takes effect on the next request.
 */
export function getMediaUseCases() {
  const library = new CloudinaryMediaLibrary();
  const usage = new MediaUsagePrismaReader();

  return { list: new ListMediaLibraryUseCase(library, usage), findOrphans: new FindOrphanImagesUseCase(library, usage) };
}

/** Separate from the reads on purpose: only the deletion gets the storage that can destroy files. */
export function getOrphanDeletion() {
  return new DeleteOrphanImagesUseCase(new CloudinaryMediaLibrary(), new MediaUsagePrismaReader(), new CloudinaryMediaStorage());
}
