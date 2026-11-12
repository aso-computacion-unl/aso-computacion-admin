import { BudgetedMailSender, type MailSender } from "@/application";
import { MailDailyBudgetPrismaStore } from "@/infrastructure";
import { GmailSmtpTransport, createGmailTransporter } from "@/infrastructure/mail/gmail-smtp-transport";
import { gmailConfig, mailDailyLimit } from "@/infrastructure/mail/mail-config";

/**
 * The app's mail sender: Gmail when the account is configured, otherwise one that answers `not_configured` to every
 * send. Built per call (cheap, no connection until a send) so a changed environment is honoured, and so importing a
 * route never needs a database or credentials. `pooled` keeps one connection for a burst of sends: call `close()` after.
 */
export function getMailSender(env: Record<string, string | undefined> = process.env, { pooled = false }: { pooled?: boolean } = {}): MailSender {
  const config = gmailConfig(env);

  return new BudgetedMailSender(config ? new GmailSmtpTransport(config, createGmailTransporter(config, { pooled })) : null, new MailDailyBudgetPrismaStore(), mailDailyLimit(env));
}
