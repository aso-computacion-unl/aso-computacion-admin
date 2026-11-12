import type { RegistrationRefusal } from "@/domain/event-registration";
import { parseOpenRegistration } from "@/domain/event-registration";
import { publicOrigin } from "@/infrastructure/auth/auth-config";
import { mailConfigProblems } from "@/infrastructure/mail/mail-config";
import { sealRegistrationCancelToken } from "@/infrastructure/registration/registration-cancel-token";
import { sealRegistrationConfirmToken } from "@/infrastructure/registration/registration-confirm-token";
import { getMailSender } from "@/interface/mail/mail-container";
import { getEventRegistrationServices } from "@/interface/public/event-registration-container";

import { confirmationEmail } from "./registration-emails";

type Env = Record<string, string | undefined>;

/**
 * `check_email`: stored pending and the confirmation email is on its way. `refused`: the event said no (nothing stored).
 * `email_unavailable` / `email_budget`: no email could go out (mail not set up or failing / today's budget spent), so the
 * person is asked to try again later; no seat is held and the pending row, if any, is refreshed by the retry.
 */
export type OpenRegistrationRequestResult =
  | { status: "check_email" }
  | { status: "refused"; reason: Exclude<RegistrationRefusal, "mode_mismatch"> }
  | { status: "email_unavailable" | "email_budget" };

/**
 * One open-form request, after the public checks (rate limit, Turnstile): validates the fields (a `ValidationError`
 * for a bad one), makes sure an email can go out BEFORE storing anything, stores or refreshes the pending
 * registration, and sends the link that confirms it (only the latest link of an email works). The mail setup and today's budget are checked first so that a
 * refusal for those reasons leaves the stored rows exactly as they were.
 */
export async function requestOpenRegistration({ slug, form, now = new Date(), env = process.env }: { slug: string; form: Record<string, unknown>; now?: Date; env?: Env }): Promise<OpenRegistrationRequestResult> {
  const { email } = parseOpenRegistration(form);
  const origin = publicOrigin(env.AUTH_URL);
  const mailer = getMailSender(env);

  if (!origin || !mailer.isConfigured() || mailConfigProblems(env).length > 0) {
    return { status: "email_unavailable" };
  }

  if ((await mailer.remainingToday(now)) < 1) {
    return { status: "email_budget" };
  }

  const services = getEventRegistrationServices();
  // The attempt this email's link is issued for: it replaces the previous one on a pending row, which retires that link (D9).
  const nonce = crypto.randomUUID();
  const outcome = await services.registerOpen.execute({ slug, form, now, confirmNonce: nonce });

  if (outcome.status !== "registered") {
    return { status: "refused", reason: outcome.status === "mode_mismatch" ? "not_found" : outcome.status };
  }

  const event = await services.publicEvent.execute({ slug, now });

  if (!event) {
    return { status: "refused", reason: "not_found" };
  }

  const token = await sealRegistrationConfirmToken({ registrationId: outcome.registration.id, eventId: outcome.registration.eventId, nonce }, now);
  // A second link, for the person to let the registration go later (D7): its own purpose, so it never confirms.
  const cancelToken = await sealRegistrationCancelToken({ registrationId: outcome.registration.id, eventId: outcome.registration.eventId }, now);
  const message = confirmationEmail({
    event,
    confirmUrl: `${origin}/inscripciones/${event.slug}/confirmar?token=${token}`,
    cancelUrl: `${origin}/inscripciones/${event.slug}/cancelar?token=${cancelToken}`,
  });
  const sent = await mailer.send({ to: email, ...message }, now);

  return sent.status === "sent" ? { status: "check_email" } : { status: sent.status === "budget_exhausted" ? "email_budget" : "email_unavailable" };
}
