import { assertSponsorLogoAlt, type Sponsor } from "@/domain/sponsor";

import type { SponsorResult } from "../dto/sponsor-result.dto";
import { toSponsorResult } from "../mappers/sponsor-result.mapper";
import type { ImageUploadFile, MediaStoragePort } from "../ports/media-storage.port";
import type { OrderedContentRepository } from "../ports/ordered-content-repository.port";
import { destroyStoredImages } from "./destroy-stored-images";
import { NotFoundError } from "./use-case-error";
import type { UploadImageUseCase } from "./upload-image.use-case";

export const SPONSOR_LOGO_FOLDER = "sponsors";
/** Logos are small marks; 200 px keeps them sharp at the size the landing shows them and still rejects favicons. */
export const SPONSOR_LOGO_MIN_WIDTH = 200;

export interface SetSponsorLogoCommand {
  id: string;
  file: ImageUploadFile;
  alt: string;
}

/**
 * Adds or replaces a sponsor's logo.
 *
 * What can be checked without storage (alt text, the sponsor exists) is checked
 * BEFORE the upload. The DB write comes last: when it fails, the new asset is
 * nobody's, so it is destroyed (best effort, logged) and the original error is
 * rethrown. When it succeeds, the replaced logo is destroyed best effort,
 * logging any `publicId` left behind.
 */
export class SetSponsorLogoUseCase {
  constructor(
    private readonly sponsors: OrderedContentRepository<Sponsor>,
    private readonly uploadImage: UploadImageUseCase,
    private readonly storage: MediaStoragePort,
  ) {}

  async execute({ id, file, alt }: SetSponsorLogoCommand): Promise<SponsorResult> {
    const validAlt = assertSponsorLogoAlt(alt);
    const sponsor = await this.sponsors.getById(id);

    if (!sponsor) {
      throw new NotFoundError("Sponsor not found");
    }

    const asset = await this.uploadImage.execute({
      file,
      folder: SPONSOR_LOGO_FOLDER,
      minWidth: SPONSOR_LOGO_MIN_WIDTH,
    });

    let saved: Sponsor;

    try {
      saved = await this.sponsors.update(sponsor.withLogo({ ...asset, alt: validAlt }));
    } catch (error) {
      await destroyStoredImages(this.storage, [asset.publicId], `Could not save sponsor "${id}" after uploading its logo`);
      throw error;
    }

    const replaced = sponsor.props.logo?.publicId;

    if (replaced) {
      await destroyStoredImages(this.storage, [replaced], `Replaced the logo of sponsor "${id}"`);
    }

    return toSponsorResult(saved);
  }
}
