import "server-only";
import nodemailer, { type SendMailOptions } from "nodemailer";

import type { MailMessage, MailTransport } from "@/application/ports/mail.ports";

import type { GmailConfig } from "./mail-config";

/** The part of a nodemailer transporter this adapter uses, so a test can hand in one that builds the message in memory. */
export interface Mailer {
  sendMail(options: SendMailOptions): Promise<unknown>;
}

// A serverless function must not hang on a dead connection: every wait is short and bounded.
const CONNECTION_TIMEOUT_MS = 10_000;
const GREETING_TIMEOUT_MS = 10_000;
const SOCKET_TIMEOUT_MS = 15_000;

/** SMTPS to Gmail with an app password (no domain needed). */
export function createGmailTransporter(config: GmailConfig) {
  return nodemailer.createTransport({
    host: "smtp.gmail.com",
    port: 465,
    secure: true,
    auth: { user: config.user, pass: config.appPassword },
    connectionTimeout: CONNECTION_TIMEOUT_MS,
    greetingTimeout: GREETING_TIMEOUT_MS,
    socketTimeout: SOCKET_TIMEOUT_MS,
  });
}

/** `MailTransport` over Gmail's SMTP. Replace it with another transport to change provider; nothing else knows Gmail. */
export class GmailSmtpTransport implements MailTransport {
  constructor(
    private readonly config: GmailConfig,
    private readonly mailer: Mailer = createGmailTransporter(config),
  ) {}

  async deliver(message: MailMessage): Promise<void> {
    try {
      await this.mailer.sendMail({
        from: { name: this.config.fromName, address: this.config.user },
        to: message.to,
        subject: message.subject,
        text: message.text,
        ...(message.html ? { html: message.html } : {}),
      });
    } catch (error) {
      // The provider's message can repeat the recipient: only its codes are logged.
      const { code, responseCode } = error as { code?: unknown; responseCode?: unknown };

      console.error("Gmail SMTP send failed", { code, responseCode });

      throw error;
    }
  }
}
