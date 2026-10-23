import {
  CreatePillarUseCase,
  DeletePillarUseCase,
  GetOrderedContentUseCase,
  ListOrderedContentUseCase,
  MoveOrderedContentUseCase,
  RemovePillarImageUseCase,
  SetOrderedContentPublishedUseCase,
  SetPillarImageUseCase,
  UpdatePillarUseCase,
  UploadImageUseCase,
} from "@/application";
import { toPillarResult } from "@/application/mappers/pillar-result.mapper";
import { PillarPrismaRepository } from "@/infrastructure";
import { CloudinaryMediaStorage } from "@/infrastructure/storage/cloudinary-media-storage";
import { LazyMediaStorage } from "@/infrastructure/storage/lazy-media-storage";

const NOT_FOUND = "Pillar not found";

function createPillarUseCases() {
  const pillars = new PillarPrismaRepository();
  const storage = new LazyMediaStorage(() => new CloudinaryMediaStorage());

  return {
    list: new ListOrderedContentUseCase(pillars, toPillarResult),
    get: new GetOrderedContentUseCase(pillars, toPillarResult, NOT_FOUND),
    create: new CreatePillarUseCase(pillars),
    update: new UpdatePillarUseCase(pillars),
    setPublished: new SetOrderedContentPublishedUseCase(pillars, toPillarResult, NOT_FOUND),
    delete: new DeletePillarUseCase(pillars, storage),
    move: new MoveOrderedContentUseCase(pillars, NOT_FOUND),
    setImage: new SetPillarImageUseCase(pillars, new UploadImageUseCase(storage), storage),
    removeImage: new RemovePillarImageUseCase(pillars, storage),
  };
}

let useCases: ReturnType<typeof createPillarUseCases> | undefined;

/**
 * Built on first use, not at import time: the Cloudinary adapter reads its
 * credentials in the constructor, and a build that merely imports the actions
 * must not need them.
 */
export function getPillarUseCases() {
  useCases ??= createPillarUseCases();
  return useCases;
}
