import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { domainToASCII } from "node:url";

/*
 * Reads what the app "sent" while `scripts/run-e2e.mjs` ran the SMTP sink (e2e/support/smtp-sink.ts): the messages
 * are files in the directory named by E2E_MAIL_DIR. A spec asks for the mail to an address and takes the
 * confirmation link from its text, the way a person would, instead of signing the token itself. Node runs this
 * file as is (types are stripped), so it uses no TypeScript-only syntax.
 */

export interface ReceivedMail {
  from: string;
  to: string[];
  subject: string;
  /** The text/plain body, decoded. */
  text: string;
  /** The text/html body, decoded ("" when the message has none). */
  html: string;
}

function decodeQuotedPrintable(text: string): string {
  const bytes = Buffer.from(text.replace(/=\r?\n/g, "").replace(/=([0-9A-F]{2})/gi, (_match, hex: string) => String.fromCharCode(Number.parseInt(hex, 16))), "latin1");

  return bytes.toString("utf8");
}

/** `=?UTF-8?Q?...?=` and `=?UTF-8?B?...?=` words in a header, as written by nodemailer for non-ASCII text. */
function decodeHeader(value: string): string {
  // White space between two encoded words is only a line fold, not part of the text.
  return value.replace(/\?=\s+=\?/g, "?==?").replace(/=\?UTF-8\?([QB])\?([^?]*)\?=/gi, (_word, encoding: string, payload: string) =>
    encoding.toUpperCase() === "B" ? Buffer.from(payload, "base64").toString("utf8") : decodeQuotedPrintable(payload.replace(/_/g, " ")),
  );
}

function splitPart(part: string): { headers: Map<string, string>; body: string } {
  const end = part.indexOf("\r\n\r\n");
  const head = end === -1 ? part : part.slice(0, end);
  const headers = new Map<string, string>();

  // A header continues on the next line when that one starts with white space.
  for (const line of head.replace(/\r\n[ \t]+/g, " ").split("\r\n")) {
    const colon = line.indexOf(":");

    if (colon > 0) headers.set(line.slice(0, colon).trim().toLowerCase(), line.slice(colon + 1).trim());
  }

  return { headers, body: end === -1 ? "" : part.slice(end + 4) };
}

function decodeBody(body: string, encoding: string | undefined): string {
  switch (encoding?.toLowerCase()) {
    case "quoted-printable":
      return decodeQuotedPrintable(body);
    case "base64":
      return Buffer.from(body.replace(/\s+/g, ""), "base64").toString("utf8");
    default:
      return body;
  }
}

/** The text/plain and text/html bodies of a MIME part, looking through nested multipart parts. */
function bodies(part: string): { text: string; html: string } {
  const { headers, body } = splitPart(part);
  const type = headers.get("content-type") ?? "text/plain";
  const boundary = /boundary="?([^";]+)"?/i.exec(type)?.[1];

  if (/^multipart\//i.test(type) && boundary) {
    const found = { text: "", html: "" };

    for (const child of body.split(`--${boundary}`).slice(1)) {
      if (child.startsWith("--")) break;

      const inner = bodies(child.replace(/^\r\n/, ""));

      found.text ||= inner.text;
      found.html ||= inner.html;
    }

    return found;
  }

  const decoded = decodeBody(body, headers.get("content-transfer-encoding"));

  return /^text\/html/i.test(type) ? { text: "", html: decoded } : /^text\/plain/i.test(type) ? { text: decoded, html: "" } : { text: "", html: "" };
}

/** Parses the raw message the sink stored. Enough MIME for what nodemailer writes: headers, multipart, quoted-printable, base64. */
export function parseMail(message: { from: string; to: string[]; raw: string }): ReceivedMail {
  const { headers } = splitPart(message.raw);

  return { from: message.from, to: message.to, subject: decodeHeader(headers.get("subject") ?? ""), ...bodies(message.raw) };
}

/** Everything the sink received so far, oldest first. */
export function receivedMail(directory: string | undefined = process.env.E2E_MAIL_DIR): ReceivedMail[] {
  if (!directory) throw new Error("E2E_MAIL_DIR is not set: run the suite with `npm run e2e`, which starts the mail sink.");

  return readdirSync(directory)
    .filter((name) => name.endsWith(".json"))
    .sort()
    .map((name) => parseMail(JSON.parse(readFileSync(join(directory, name), "utf8")) as { from: string; to: string[]; raw: string }));
}

/** An address as the SMTP envelope carries it: lower case, with an international domain in its ASCII (punycode) form. */
function envelopeAddress(address: string): string {
  const lower = address.trim().toLowerCase();
  const at = lower.lastIndexOf("@");

  return at === -1 ? lower : `${lower.slice(0, at)}@${domainToASCII(lower.slice(at + 1))}`;
}

/**
 * The mails sent to an address (any case) once there are at least `count` of them, newest last. A confirmation
 * goes out right after the form is answered, but the app sends it from its own process: it polls for a few seconds.
 */
export async function waitForMail(to: string, { count = 1, timeoutMs = 15_000, directory }: { count?: number; timeoutMs?: number; directory?: string } = {}): Promise<ReceivedMail[]> {
  const wanted = envelopeAddress(to);
  const deadline = Date.now() + timeoutMs;

  for (;;) {
    const mails = receivedMail(directory).filter((mail) => mail.to.some((address) => envelopeAddress(address) === wanted));

    if (mails.length >= count) return mails;
    if (Date.now() > deadline) throw new Error(`Expected ${count} mail(s) to ${to} within ${timeoutMs} ms, got ${mails.length}.`);

    await new Promise((resolve) => setTimeout(resolve, 100));
  }
}

/** The confirmation link an email carries (`/inscripciones/<slug>/confirmar?token=…`), as the path a browser opens on the app. */
export function confirmationLink(mail: ReceivedMail): string {
  const match = /https?:\/\/[^\s"'<>]+\/inscripciones\/[^\s"'<>/]+\/confirmar\?token=[^\s"'<>]+/.exec(mail.text);

  if (!match) throw new Error(`No confirmation link in the mail "${mail.subject}".`);

  const url = new URL(match[0]);

  return `${url.pathname}${url.search}`;
}
