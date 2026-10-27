import {
  CreateSponsorUseCase,
  GetOrderedContentUseCase,
  ListOrderedContentUseCase,
  MoveOrderedContentUseCase,
  ReorderOrderedContentUseCase,
  RemoveSponsorLogoUseCase,
  SetOrderedContentPublishedUseCase,
  SetSponsorLogoUseCase,
  TrashContentUseCase,
  UpdateSponsorUseCase,
  UploadImageUseCase,
} from "@/application";
import { toSponsorResult } from "@/application/mappers/sponsor-result.mapper";
import { SponsorPrismaRepository } from "@/infrastructure";
import { CloudinaryMediaStorage } from "@/infrastructure/storage/cloudinary-media-storage";
import { LazyMediaStorage } from "@/infrastructure/storage/lazy-media-storage";

const NOT_FOUND = "Sponsor not found";

function createSponsorUseCases() {
  const sponsors = new SponsorPrismaRepository();
  const storage = new LazyMediaStorage(() => new CloudinaryMediaStorage());

  return {
    list: new ListOrderedContentUseCase(sponsors, toSponsorResult),
    get: new GetOrderedContentUseCase(sponsors, toSponsorResult, NOT_FOUND),
    create: new CreateSponsorUseCase(sponsors),
    update: new UpdateSponsorUseCase(sponsors),
    setPublished: new SetOrderedContentPublishedUseCase(sponsors, toSponsorResult, NOT_FOUND),
    trash: new TrashContentUseCase(sponsors, NOT_FOUND),
    move: new MoveOrderedContentUseCase(sponsors, NOT_FOUND),
    reorder: new ReorderOrderedContentUseCase(sponsors, NOT_FOUND),
    setLogo: new SetSponsorLogoUseCase(sponsors, new UploadImageUseCase(storage), storage),
    removeLogo: new RemoveSponsorLogoUseCase(sponsors, storage),
  };
}

let useCases: ReturnType<typeof createSponsorUseCases> | undefined;

/**
 * Built on first use, not at import time: the Cloudinary adapter reads its
 * credentials in the constructor, and a build that merely imports the actions
 * must not need them.
 */
export function getSponsorUseCases() {
  useCases ??= createSponsorUseCases();
  return useCases;
}
