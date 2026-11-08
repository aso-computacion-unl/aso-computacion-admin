import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
// The setup file replaces the container with the test double; this suite is about the real one.
vi.unmock("@/interface/mail/mail-container");

import { getMailSender } from "@/interface/mail/mail-container";

describe("getMailSender", () => {
  it("without the Gmail account answers not_configured and has no budget to offer, touching no database", async () => {
    const mailer = getMailSender({});

    expect(await mailer.send({ to: "ana@example.com", subject: "s", text: "t" })).toEqual({ status: "not_configured" });
    expect(await mailer.remainingToday()).toBe(0);
  });

  it("with a placeholder account is still not configured", async () => {
    const mailer = getMailSender({ MAIL_GMAIL_USER: "__REPLACE_MAIL_GMAIL_USER__", MAIL_GMAIL_APP_PASSWORD: "__REPLACE_MAIL_GMAIL_APP_PASSWORD__" });

    expect(await mailer.send({ to: "ana@example.com", subject: "s", text: "t" })).toEqual({ status: "not_configured" });
  });
});
