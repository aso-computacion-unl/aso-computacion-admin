import { EVENT_PHOTO_FOLDER } from "./use-cases/attach-event-photo.use-case";
import { BOARD_PHOTO_FOLDER } from "./use-cases/set-board-member-photo.use-case";
import { NEWS_COVER_FOLDER } from "./use-cases/set-news-cover.use-case";
import { PILLAR_IMAGE_FOLDER } from "./use-cases/set-pillar-image.use-case";
import { SPONSOR_LOGO_FOLDER } from "./use-cases/set-sponsor-logo.use-case";
import { TESTIMONIAL_PHOTO_FOLDER } from "./use-cases/set-testimonial-photo.use-case";

/** A column that stores the public id of an uploaded image, and the subfolder its uploads go to. */
export interface MediaOwner {
  readonly model: string;
  readonly column: string;
  readonly folder: string;
}

/**
 * Every column of the database that owns a stored image, and where its uploads live. The usage
 * reader counts exactly these columns, and orphan cleanup only touches images in exactly these
 * folders: an image whose owner is not listed here is never offered and never destroyed. A new
 * `*PublicId` column must be added here (and to the reader) before its images can be cleaned up;
 * the unit test `media-owner-coverage` fails until it is.
 */
export const MEDIA_OWNERS: readonly MediaOwner[] = [
  { model: "EventPhoto", column: "publicId", folder: EVENT_PHOTO_FOLDER },
  { model: "Pillar", column: "imagePublicId", folder: PILLAR_IMAGE_FOLDER },
  { model: "NewsItem", column: "coverPublicId", folder: NEWS_COVER_FOLDER },
  { model: "BoardMember", column: "photoPublicId", folder: BOARD_PHOTO_FOLDER },
  { model: "Testimonial", column: "photoPublicId", folder: TESTIMONIAL_PHOTO_FOLDER },
  { model: "Sponsor", column: "logoPublicId", folder: SPONSOR_LOGO_FOLDER },
];

/** The subfolders (under the app's folder) whose owners the usage reader counts. */
export const MANAGED_MEDIA_FOLDERS: readonly string[] = [...new Set(MEDIA_OWNERS.map((owner) => owner.folder))];

export const isManagedMediaFolder = (folder: string) => MANAGED_MEDIA_FOLDERS.includes(folder);
