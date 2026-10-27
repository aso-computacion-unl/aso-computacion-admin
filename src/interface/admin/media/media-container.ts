import { ListMediaLibraryUseCase } from "@/application";
import { MediaUsagePrismaReader } from "@/infrastructure/repositories/media-usage-prisma.reader";
import { CloudinaryMediaLibrary } from "@/infrastructure/storage/cloudinary-media-library";

/**
 * Built on each read, not at import time: the Cloudinary adapter reads its credentials in the
 * constructor, and a build that merely imports the page must not need them. A failed build is
 * not cached, so a fixed configuration takes effect on the next request.
 */
export function getMediaUseCases() {
  const usage = new MediaUsagePrismaReader();

  return { list: new ListMediaLibraryUseCase(new CloudinaryMediaLibrary(), usage) };
}
