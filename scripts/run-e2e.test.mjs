import assert from "node:assert/strict";
import { test } from "node:test";

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

test("a developer's mail account, Turnstile keys and AUTH_URL never reach the app under test", () => {
  const environment = buildAppEnvironment(DEVELOPER_SHELL, DATABASE_URL);

  assert.equal(environment.MAIL_GMAIL_USER, "");
  assert.equal(environment.MAIL_GMAIL_APP_PASSWORD, "");
  assert.equal(environment.GOOGLE_CLIENT_ID, "");
  assert.equal(environment.TURNSTILE_SITE_KEY, "");
  assert.equal(environment.TURNSTILE_SECRET_KEY, "");
  assert.equal(environment.AUTH_URL, "");
  assert.equal(environment.PATH, "/usr/bin");
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
