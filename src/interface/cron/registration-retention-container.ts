import { PurgeExpiredRegistrationsUseCase } from "@/application";
import { EventRegistrationRetentionPrismaStore } from "@/infrastructure";

let useCase: PurgeExpiredRegistrationsUseCase | undefined;

/** Built on first use so importing the cron route never needs a database. */
export function getPurgeExpiredRegistrations(): PurgeExpiredRegistrationsUseCase {
  useCase ??= new PurgeExpiredRegistrationsUseCase(new EventRegistrationRetentionPrismaStore());

  return useCase;
}
