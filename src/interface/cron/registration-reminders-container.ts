import { SendRegistrationRemindersUseCase, type ReminderMessageBuilder } from "@/application";
import { EventPrismaRepository, EventRegistrationPrismaRepository } from "@/infrastructure";
import { publicOrigin } from "@/infrastructure/auth/auth-config";
import { buildReminderMessage } from "@/interface/event-registration/reminder-message";
import { getMailSender } from "@/interface/mail/mail-container";

/** The links of the reminder are built from the admin's public address; without one there is nothing to link to and nothing is sent. */
function messageBuilder(origin: string | undefined): ReminderMessageBuilder | null {
  if (!origin) return null;

  return buildReminderMessage(origin);
}

/**
 * The reminders and the mail connection they use. Built per run (cheap; no database or connection until used) with a
 * pooled sender, so the burst of sends shares one connection: `close()` it when the run is over.
 */
export function getRegistrationReminders(env: Record<string, string | undefined> = process.env) {
  const mailer = getMailSender(env, { pooled: true });

  return {
    execute: (input: Parameters<SendRegistrationRemindersUseCase["execute"]>[0]) =>
      new SendRegistrationRemindersUseCase(new EventPrismaRepository(), new EventRegistrationPrismaRepository(), mailer, messageBuilder(publicOrigin(env.AUTH_URL))).execute(input),
    close: () => mailer.close(),
  };
}
