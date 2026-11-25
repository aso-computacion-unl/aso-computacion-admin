import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdtempSync, readdirSync, readFileSync, rmSync } from "node:fs";
import { connect } from "node:net";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "node:test";
import { fileURLToPath } from "node:url";

import { E2E_SMTP_PORT, startSmtpSink } from "../e2e/support/smtp-sink.ts";
import { confirmationLink, waitForMail } from "../e2e/support/mail-sink.ts";
import { buildAppEnvironment } from "./run-e2e.mjs";

// Run with `node --test scripts/run-e2e.test.mjs`: what the app under test sees, whatever the developer's shell has.
const DATABASE_URL = "postgresql://test:test@127.0.0.1:5433/test";
const DEVELOPER_SHELL = {
  PATH: "/usr/bin",
  MAIL_GMAIL_USER: "me@gmail.com",
  MAIL_GMAIL_APP_PASSWORD: "abcd efgh ijkl mnop",
  TURNSTILE_SECRET_KEY: "real-secret",
  TURNSTILE_SITE_KEY: "real-site-key",
  AUTH_URL: "https://admin.example.org",
  GOOGLE_CLIENT_ID: "google-id",
};

test("a developer's mail account, Turnstile keys, SMTP host and AUTH_URL never reach the app under test: it gets test values", () => {
  const environment = buildAppEnvironment({ ...DEVELOPER_SHELL, MAIL_SMTP_HOST: "smtp.example.org", MAIL_SMTP_PORT: "587" }, DATABASE_URL);

  assert.equal(environment.MAIL_GMAIL_USER, "e2e-sender@example.org");
  assert.equal(environment.MAIL_GMAIL_APP_PASSWORD, "e2e-only-app-password");
  assert.equal(environment.TURNSTILE_SITE_KEY, "1x00000000000000000000AA");
  assert.equal(environment.TURNSTILE_SECRET_KEY, "1x0000000000000000000000000000000AA");
  assert.equal(environment.AUTH_URL, "http://127.0.0.1:3100");
  assert.equal(environment.GOOGLE_CLIENT_ID, "");
  assert.equal(environment.PATH, "/usr/bin");
  assert.ok(!JSON.stringify(environment).includes("real-secret"));
  assert.ok(!JSON.stringify(environment).includes("me@gmail.com"));
});

test("every message the app sends goes to the local sink, never to Gmail", () => {
  const environment = buildAppEnvironment(DEVELOPER_SHELL, DATABASE_URL);

  assert.equal(environment.MAIL_SMTP_HOST, "127.0.0.1");
  assert.equal(environment.MAIL_SMTP_PORT, String(E2E_SMTP_PORT));
  assert.equal(environment.MAIL_SMTP_SECURE, "false");
});

test("the confirm secret is a test one that the app accepts: 32+ characters, different from the admin and forum secrets", () => {
  const environment = buildAppEnvironment({ FORUM_SESSION_SECRET: "f".repeat(40) }, DATABASE_URL);

  assert.ok(environment.REGISTRATION_CONFIRM_SECRET.length >= 32);
  assert.notEqual(environment.REGISTRATION_CONFIRM_SECRET, environment.ADMIN_SECRET);
  assert.notEqual(environment.REGISTRATION_CONFIRM_SECRET, environment.FORUM_SESSION_SECRET);
});

test("a caller's own confirm secret is shared with the specs, and an empty one falls back to the test secret", () => {
  assert.equal(buildAppEnvironment({ REGISTRATION_CONFIRM_SECRET: "c".repeat(40) }, DATABASE_URL).REGISTRATION_CONFIRM_SECRET, "c".repeat(40));
  assert.ok(buildAppEnvironment({ REGISTRATION_CONFIRM_SECRET: "" }, DATABASE_URL).REGISTRATION_CONFIRM_SECRET.length >= 32);
});

test("the forum domain is only set when the caller opted in to the signed-in forum suite", () => {
  assert.equal(buildAppEnvironment({}, DATABASE_URL).FORUM_ALLOWED_EMAIL_DOMAIN, "");
  assert.equal(buildAppEnvironment({ FORUM_SESSION_SECRET: "f".repeat(40) }, DATABASE_URL).FORUM_ALLOWED_EMAIL_DOMAIN, "unl.edu.ec");
});

// Deliberately invalid target: the CLI must never reach Docker or a database in these tests.
function runPreflight(environment) {
  const { status, stdout, stderr } = spawnSync(process.execPath, ["--disable-warning=MODULE_TYPELESS_PACKAGE_JSON", fileURLToPath(new URL("./run-e2e.mjs", import.meta.url))], {
    env: { TEST_DATABASE_URL: "invalid", ...environment },
    encoding: "utf8",
  });

  return { status, stdout, stderr };
}

const invalidDatabaseResult = {
  status: 1,
  stdout: "",
  stderr: "TEST_DATABASE_URL must target the isolated Prisma test database. Set it to the documented canonical test URL.\n",
};
const testForumSecret = "e2e-only-forum-secret-0123456789-abcdefghij";

for (const [label, config] of Object.entries({
  missing: {},
  empty: { FORUM_SESSION_SECRET: "" },
  short: { FORUM_SESSION_SECRET: "short" },
  placeholder: { FORUM_SESSION_SECRET: `__REPLACE_${"X".repeat(32)}__` },
  reused: { FORUM_SESSION_SECRET: testForumSecret, ADMIN_SECRET: testForumSecret },
})) {
  test(`preflight rejects ${label} signed-in UNL configuration in CI`, () => {
    assert.deepEqual(runPreflight({ CI: "true", ...config }), {
      status: 1,
      stdout: "",
      stderr: "Signed-in UNL e2e coverage in CI requires FORUM_SESSION_SECRET: set a test-only value of at least 32 characters, distinct from ADMIN_SECRET.\n",
    });
  });
}

test("preflight accepts signed-in UNL configuration in CI", () => {
  assert.deepEqual(runPreflight({ CI: "true", FORUM_SESSION_SECRET: testForumSecret }), invalidDatabaseResult);
});

test("preflight leaves signed-in UNL configuration optional locally", () => {
  assert.deepEqual(runPreflight({}), invalidDatabaseResult);
  assert.deepEqual(runPreflight({ CI: "false" }), invalidDatabaseResult);
  assert.equal(buildAppEnvironment({}, DATABASE_URL).FORUM_SESSION_SECRET, "");
});

test("the sink reads the envelope address between the first < and the next >, and keeps the whole argument without a >", async () => {
  const directory = mkdtempSync(join(tmpdir(), "e2e-sink-test-"));
  const sink = await startSmtpSink({ directory, port: 0 });

  try {
    const session = [
      "EHLO test",
      "MAIL FROM:<ana@example.org> SIZE=10",
      "RCPT TO:<uno@example.org>",
      "RCPT TO:<dos@example.org> ORCPT=rfc822;dos>tres",
      "RCPT TO:<>",
      "RCPT TO:<a<b@example.org>",
      "RCPT TO:<sin-cierre@example.org NOTIFY=NEVER",
      "DATA",
      "Subject: x",
      "",
      "cuerpo",
      ".",
      "QUIT",
    ];
    const replies = await new Promise((resolve, reject) => {
      let received = "";
      const socket = connect(sink.port, "127.0.0.1", () => socket.write(`${session.join("\r\n")}\r\n`));

      socket.setEncoding("utf8");
      socket.on("data", (chunk) => (received += chunk));
      socket.on("error", reject);
      socket.on("close", () => resolve(received));
    });
    const files = readdirSync(directory).filter((name) => name.endsWith(".json"));

    assert.match(replies, /250 OK queued\r\n221 Bye\r\n$/);
    assert.equal(files.length, 1);

    const message = JSON.parse(readFileSync(join(directory, files[0]), "utf8"));

    assert.equal(message.from, "ana@example.org");
    assert.deepEqual(message.to, ["uno@example.org", "dos@example.org", "", "a<b@example.org", "TO:<sin-cierre@example.org NOTIFY=NEVER"]);
    assert.equal(message.raw, "Subject: x\r\n\r\ncuerpo");
  } finally {
    await sink.close();
    rmSync(directory, { force: true, recursive: true });
  }
});

test("the sink keeps what nodemailer sends it, and a spec reads the confirmation link from the text", async () => {
  const nodemailer = (await import("nodemailer")).default;
  const directory = mkdtempSync(join(tmpdir(), "e2e-sink-test-"));
  const sink = await startSmtpSink({ directory, port: 0 });
  const link = `http://127.0.0.1:3100/inscripciones/taller/confirmar?token=${"a".repeat(120)}.b-c_d`;

  try {
    const transporter = nodemailer.createTransport({ host: "127.0.0.1", port: sink.port, secure: false, auth: { user: "e2e-sender@example.org", pass: "x" } });

    await transporter.sendMail({ from: "e2e-sender@example.org", to: "Ana@Example.com", subject: "Confirme su cupo en «Taller ñandú»", text: `Hola:\n\n${link}\n\n.\nAdiós`, html: `<p>${link}</p>` });
    transporter.close();

    const [mail, ...others] = await waitForMail("ana@example.com", { directory });

    assert.deepEqual(others, []);
    assert.equal(mail.subject, "Confirme su cupo en «Taller ñandú»");
    assert.deepEqual(mail.to, ["Ana@example.com"]);
    assert.ok(mail.text.includes("Adiós"));
    assert.ok(mail.html.includes("<p>http://127.0.0.1:3100/inscripciones/taller/confirmar?token="));
    assert.equal(confirmationLink(mail), `/inscripciones/taller/confirmar?token=${"a".repeat(120)}.b-c_d`);
    await assert.rejects(waitForMail("nadie@example.com", { directory, timeoutMs: 200 }), /Expected 1 mail/);
  } finally {
    await sink.close();
    rmSync(directory, { force: true, recursive: true });
  }
});
