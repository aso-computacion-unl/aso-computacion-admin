import {
  CountByStatusUseCase,
  CreateNewsItemUseCase,
  DeleteNewsItemUseCase,
  GetNewsItemUseCase,
  ListNewsItemsUseCase,
  RemoveNewsCoverUseCase,
  SetNewsCoverUseCase,
  SetNewsItemPublishedUseCase,
  UpdateNewsItemUseCase,
  UploadImageUseCase,
} from "@/application";
import { NewsPrismaRepository } from "@/infrastructure";
import { CloudinaryMediaStorage } from "@/infrastructure/storage/cloudinary-media-storage";
import { LazyMediaStorage } from "@/infrastructure/storage/lazy-media-storage";

function createNewsUseCases() {
  const news = new NewsPrismaRepository();
  const storage = new LazyMediaStorage(() => new CloudinaryMediaStorage());

  return {
    list: new ListNewsItemsUseCase(news),
    count: new CountByStatusUseCase(news),
    get: new GetNewsItemUseCase(news),
    create: new CreateNewsItemUseCase(news),
    update: new UpdateNewsItemUseCase(news),
    setPublished: new SetNewsItemPublishedUseCase(news),
    delete: new DeleteNewsItemUseCase(news, storage),
    setCover: new SetNewsCoverUseCase(news, new UploadImageUseCase(storage), storage),
    removeCover: new RemoveNewsCoverUseCase(news, storage),
  };
}

let useCases: ReturnType<typeof createNewsUseCases> | undefined;

/**
 * Built on first use, not at import time: the Cloudinary adapter reads its
 * credentials in the constructor, and a build that merely imports the actions
 * must not need them.
 */
export function getNewsUseCases() {
  useCases ??= createNewsUseCases();
  return useCases;
}
