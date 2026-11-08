import nodemailer from "nodemailer";
import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import { GmailSmtpTransport, createGmailTransporter } from "@/infrastructure/mail/gmail-smtp-transport";

const CONFIG = { user: "asociacion@gmail.com", appPassword: "abcdefghijklmnop", fromName: "ASO Computación" };

/** Builds the real MIME message in memory instead of opening a connection. */
const mimeTransporter = () => nodemailer.createTransport({ streamTransport: true, buffer: true });

async function deliverMime(message: Parameters<GmailSmtpTransport["deliver"]>[0]) {
  const transporter = mimeTransporter();
  const spy = vi.spyOn(transporter, "sendMail");

  await new GmailSmtpTransport(CONFIG, transporter).deliver(message);

  return { raw: String((await spy.mock.results[0]!.value).message), options: spy.mock.calls[0]![0] };
}

afterEach(() => {
  vi.restoreAllMocks();
});

describe("GmailSmtpTransport", () => {
  it("sends from the association's Gmail account under its display name, as plain text and HTML", async () => {
    const { raw, options } = await deliverMime({ to: "ana@example.com", subject: "Confirme su cupo", text: "Texto plano", html: "<p>Hola</p>" });

    expect(options).toMatchObject({ from: { name: "ASO Computación", address: "asociacion@gmail.com" }, to: "ana@example.com", subject: "Confirme su cupo" });
    expect(raw).toMatch(/^From: =\?UTF-8\?Q\?ASO_Computaci=C3=B3n\?= <asociacion@gmail.com>$/m);
    expect(raw).toMatch(/^To: ana@example.com$/m);
    expect(raw).toContain("Texto plano");
    expect(raw).toContain("<p>Hola</p>");
  });

  it("sends text only when there is no HTML", async () => {
    const { raw } = await deliverMime({ to: "ana@example.com", subject: "Hola", text: "Solo texto" });

    expect(raw).toContain("Content-Type: text/plain");
    expect(raw).not.toContain("text/html");
  });

  it("cannot be tricked into adding recipients or headers through the subject or the address", async () => {
    const { raw } = await deliverMime({ to: "ana@example.com", subject: "Hola\r\nBcc: spy@example.com", text: "x" });

    expect(raw).not.toMatch(/^Bcc:/m);
    expect(raw.match(/^To: .*$/gm)).toEqual(["To: ana@example.com"]);
  });

  it("rejects, without claiming it sent, when the SMTP server refuses; the log carries a code and never the address", async () => {
    const consoleError = vi.spyOn(console, "error").mockImplementation(() => undefined);
    const failure = Object.assign(new Error("550 5.1.1 <ana@example.com>: Recipient address rejected"), { code: "EENVELOPE", responseCode: 550 });
    const transporter = { sendMail: vi.fn().mockRejectedValue(failure) };

    await expect(new GmailSmtpTransport(CONFIG, transporter).deliver({ to: "ana@example.com", subject: "s", text: "t" })).rejects.toBe(failure);
    expect(consoleError).toHaveBeenCalledOnce();
    expect(JSON.stringify(consoleError.mock.calls)).toContain("EENVELOPE");
    expect(JSON.stringify(consoleError.mock.calls)).not.toContain("ana@example.com");
  });

  it("builds a bounded SMTPS connection to Gmail with the app password", () => {
    const options = createGmailTransporter(CONFIG).options as Record<string, unknown>;

    expect(options).toMatchObject({ host: "smtp.gmail.com", port: 465, secure: true, auth: { user: "asociacion@gmail.com", pass: "abcdefghijklmnop" } });
    for (const timeout of ["connectionTimeout", "greetingTimeout", "socketTimeout"]) {
      expect(options[timeout], timeout).toBeGreaterThan(0);
      expect(options[timeout] as number, timeout).toBeLessThanOrEqual(15_000);
    }
  });
});
