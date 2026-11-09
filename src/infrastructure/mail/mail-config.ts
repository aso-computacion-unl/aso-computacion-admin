import { requireRuntimeValue } from "@/infrastructure/config/runtime-env";

type Env = Record<string, string | undefined>;

/** Gmail lets a free account send about 500 messages a day; this leaves room for the ones sent by hand. */
export const DEFAULT_MAIL_DAILY_LIMIT = 400;
const DAILY_LIMIT_MAX = 100_000;
const DEFAULT_FROM_NAME = "ASO Computación";
const FROM_NAME_MAX_LENGTH = 80;
const SECRET_MIN_LENGTH = 32;

export interface GmailConfig {
  /** The Gmail address that sends (and is the From address). */
  user: string;
  /** A Google "app password", spaces removed. Never logged. */
  appPassword: string;
  fromName: string;
}

function value(env: Env, name: string): string | undefined {
  try {
    return requireRuntimeValue(name, env[name]).trim() || undefined;
  } catch {
    return undefined;
  }
}

function gmailUser(env: Env): string | undefined {
  const user = value(env, "MAIL_GMAIL_USER");

  return user && /^[^\s@]+@[^\s@]+$/.test(user) ? user : undefined;
}

/** Google shows an app password in groups of four letters separated by spaces; the spaces are not part of it. */
function gmailAppPassword(env: Env): string | undefined {
  return value(env, "MAIL_GMAIL_APP_PASSWORD")?.replace(/\s+/g, "") || undefined;
}

/** The Gmail account that sends, or null while `MAIL_GMAIL_USER` / `MAIL_GMAIL_APP_PASSWORD` are missing, placeholders or malformed: no mail goes out. */
export function gmailConfig(env: Env = process.env): GmailConfig | null {
  const user = gmailUser(env);
  const appPassword = gmailAppPassword(env);

  if (!user || !appPassword) {
    return null;
  }

  // Control characters would end the header line: the name is one line of text or the default.
  const fromName = (value(env, "MAIL_FROM_NAME") ?? "").replace(/[\u0000-\u001f\u007f-\u009f]+/g, " ").replace(/\s+/g, " ").trim().slice(0, FROM_NAME_MAX_LENGTH);

  return { user, appPassword, fromName: fromName || DEFAULT_FROM_NAME };
}

function configuredDailyLimit(env: Env): number | undefined {
  const raw = value(env, "MAIL_DAILY_LIMIT");

  if (raw === undefined) {
    return undefined;
  }

  const parsed = /^\d{1,6}$/.test(raw) ? Number(raw) : Number.NaN;

  return Number.isInteger(parsed) && parsed >= 1 && parsed <= DAILY_LIMIT_MAX ? parsed : undefined;
}

/** How many messages a day may go out: `MAIL_DAILY_LIMIT` when it is a whole number from 1 to 100000, else the default. */
export function mailDailyLimit(env: Env = process.env): number {
  return configuredDailyLimit(env) ?? DEFAULT_MAIL_DAILY_LIMIT;
}

/**
 * The secret that signs the email-confirmation links, or undefined when it is missing, a placeholder, too short or
 * the same as `ADMIN_SECRET` / `FORUM_SESSION_SECRET`: one leaked secret must never be able to sign two kinds of token.
 */
export function registrationConfirmSecret(env: Env = process.env): string | undefined {
  const secret = value(env, "REGISTRATION_CONFIRM_SECRET");

  return secret && secret.length >= SECRET_MIN_LENGTH && secret !== value(env, "ADMIN_SECRET") && secret !== value(env, "FORUM_SESSION_SECRET") ? secret : undefined;
}

/** The variables to fix while confirmation emails cannot go out (names only, never values). */
export function mailConfigProblems(env: Env = process.env): string[] {
  const problems: string[] = [];

  if (!gmailUser(env)) problems.push("MAIL_GMAIL_USER");
  if (!gmailAppPassword(env)) problems.push("MAIL_GMAIL_APP_PASSWORD");
  if (!registrationConfirmSecret(env)) problems.push("REGISTRATION_CONFIRM_SECRET");
  if (value(env, "MAIL_DAILY_LIMIT") !== undefined && configuredDailyLimit(env) === undefined) problems.push("MAIL_DAILY_LIMIT");

  return problems;
}
