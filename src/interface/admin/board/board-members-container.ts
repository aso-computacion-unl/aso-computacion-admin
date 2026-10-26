import {
  CreateBoardMemberUseCase,
  GetOrderedContentUseCase,
  ListOrderedContentUseCase,
  MoveOrderedContentUseCase,
  RemoveBoardMemberPhotoUseCase,
  SetBoardMemberPhotoUseCase,
  SetOrderedContentPublishedUseCase,
  UpdateBoardMemberUseCase,
  UploadImageUseCase,
  TrashContentUseCase,
} from "@/application";
import { toBoardMemberResult } from "@/application/mappers/board-member-result.mapper";
import { BoardMemberPrismaRepository } from "@/infrastructure";
import { CloudinaryMediaStorage } from "@/infrastructure/storage/cloudinary-media-storage";
import { LazyMediaStorage } from "@/infrastructure/storage/lazy-media-storage";

const NOT_FOUND = "Board member not found";

function createBoardMemberUseCases() {
  const members = new BoardMemberPrismaRepository();
  const storage = new LazyMediaStorage(() => new CloudinaryMediaStorage());

  return {
    list: new ListOrderedContentUseCase(members, toBoardMemberResult),
    get: new GetOrderedContentUseCase(members, toBoardMemberResult, NOT_FOUND),
    create: new CreateBoardMemberUseCase(members),
    update: new UpdateBoardMemberUseCase(members),
    setPublished: new SetOrderedContentPublishedUseCase(members, toBoardMemberResult, NOT_FOUND),
    trash: new TrashContentUseCase(members, NOT_FOUND),
    move: new MoveOrderedContentUseCase(members, NOT_FOUND),
    setPhoto: new SetBoardMemberPhotoUseCase(members, new UploadImageUseCase(storage), storage),
    removePhoto: new RemoveBoardMemberPhotoUseCase(members, storage),
  };
}

let useCases: ReturnType<typeof createBoardMemberUseCases> | undefined;

/**
 * Built on first use, not at import time: the Cloudinary adapter reads its
 * credentials in the constructor, and a build that merely imports the actions
 * must not need them.
 */
export function getBoardMemberUseCases() {
  useCases ??= createBoardMemberUseCases();
  return useCases;
}
