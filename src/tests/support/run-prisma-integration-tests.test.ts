import { describe, expect, it, vi } from "vitest";

import { CANONICAL_TEST_DATABASE_URL } from "./prisma-test-target";
import {
  createIntegrationEnvironment,
  runPrismaIntegrationTests,
} from "../../../scripts/run-prisma-integration-tests.mjs";

const LOCAL_DOCKER_CONTEXT = { status: 0, stdout: "unix:///var/run/docker.sock\n" };
const LOCAL_DOCKER_CONTEXT_COMMAND = [
  "--context",
  "default",
  "context",
  "inspect",
  "default",
  "--format",
  "{{.Endpoints.docker.Host}}",
];

describe("createIntegrationEnvironment", () => {
  it("maps only required integration variables to the child environment", () => {
    const childEnvironment = createIntegrationEnvironment(CANONICAL_TEST_DATABASE_URL, {
        DATABASE_URL: "postgresql://development:development@localhost:5432/development",
        OTHER_VALUE: "secret-that-must-not-leak",
        PATH: "/usr/bin",
        DOCKER_CONFIG: "/tmp/hostile-docker-config",
        HOME: "/tmp/hostile-home",
      }, "/tmp/aso-computacion-admin-prisma-test-1234");

    expect(childEnvironment).toMatchObject({
      DATABASE_URL: CANONICAL_TEST_DATABASE_URL,
      PATH: "/usr/bin",
      TEST_DATABASE_URL: CANONICAL_TEST_DATABASE_URL,
    });
    expect(childEnvironment.DOCKER_CONFIG).toBe("/tmp/aso-computacion-admin-prisma-test-1234");
    expect(childEnvironment.DOCKER_CONFIG).not.toBe("/tmp/hostile-docker-config");
    expect(childEnvironment.HOME).not.toBe("/tmp/hostile-home");
    expect(childEnvironment.DOCKER_CONTEXT).toBeUndefined();
  });

  it("rejects an unsafe target before returning a child environment", () => {
    expect(() => createIntegrationEnvironment(undefined, {}, "/tmp/unused")).toThrow(
      "TEST_DATABASE_URL must target the isolated Prisma test database.",
    );
  });

  it("rejects a configured Docker daemon instead of forwarding it to destructive Compose commands", () => {
    expect(() =>
      createIntegrationEnvironment(CANONICAL_TEST_DATABASE_URL, {
        DOCKER_HOST: "tcp://docker.example.test:2376",
      }, "/tmp/unused"),
    ).toThrow("DOCKER_HOST must not be configured for Prisma integration tests.");
  });
});

describe("runPrismaIntegrationTests", () => {
  it.each([
    undefined,
    "not-a-database-url",
    "postgresql://postgres:postgres@127.0.0.1:54329/aso_computacion_admin?schema=public",
  ])("rejects invalid target %j before spawning any child process", (testDatabaseUrl) => {
    const spawn = vi.fn();

    expect(() => runPrismaIntegrationTests({ TEST_DATABASE_URL: testDatabaseUrl }, { spawn })).toThrow(
      "TEST_DATABASE_URL must target the isolated Prisma test database.",
    );
    expect(spawn).not.toHaveBeenCalled();
  });

  it("proves the controlled default context is local before Compose, then runs the lifecycle", () => {
    const spawn = vi
      .fn()
      .mockReturnValueOnce(LOCAL_DOCKER_CONTEXT)
      .mockReturnValue({ status: 0 });

    runPrismaIntegrationTests(
      {
        TEST_DATABASE_URL: CANONICAL_TEST_DATABASE_URL,
        PATH: "/usr/bin",
        DOCKER_CONFIG: "/tmp/hostile-docker-config",
        DOCKER_CONTEXT: "remote-context",
        HOME: "/tmp/hostile-home",
      },
      { spawn },
    );

    expect(spawn.mock.calls.map(([command, args]) => [command, args])).toEqual([
      [
        "docker",
        [
          ...LOCAL_DOCKER_CONTEXT_COMMAND,
        ],
      ],
      [
        "docker",
        [
          "--context",
          "default",
          "compose",
          "--project-name",
          "aso-computacion-admin-prisma-test",
          "-f",
          "docker-compose.test.yml",
          "up",
          "-d",
          "--wait",
        ],
      ],
      ["npx", ["prisma", "migrate", "deploy"]],
      ["npx", ["vitest", "run", "--config", "vitest.integration.config.ts"]],
      [
        "docker",
        [
          "--context",
          "default",
          "compose",
          "--project-name",
          "aso-computacion-admin-prisma-test",
          "-f",
          "docker-compose.test.yml",
          "down",
          "-v",
          "--remove-orphans",
        ],
      ],
    ]);
    expect(spawn.mock.calls.every(([, , options]) => options.timeout > 0)).toBe(true);
    expect(spawn.mock.calls.every(([, , options]) => options.env.DATABASE_URL === CANONICAL_TEST_DATABASE_URL)).toBe(true);
    expect(spawn.mock.calls.every(([, , options]) => options.env.DOCKER_CONFIG !== "/tmp/hostile-docker-config")).toBe(true);
    expect(spawn.mock.calls.every(([, , options]) => options.env.HOME !== "/tmp/hostile-home")).toBe(true);
    expect(spawn.mock.calls.every(([, , options]) => options.env.DOCKER_CONTEXT === undefined)).toBe(true);
    expect(spawn.mock.calls[0]?.[2]?.stdio).toBe("pipe");
    expect(spawn.mock.calls.slice(1).every(([, , options]) => options.stdio === "inherit")).toBe(true);
  });

  it("uses and removes one temporary Docker and home directory outside the repository", () => {
    const temporaryDirectory = "/tmp/aso-computacion-admin-prisma-test-1234";
    const createTemporaryDirectory = vi.fn().mockReturnValue(temporaryDirectory);
    const removeTemporaryDirectory = vi.fn();
    const spawn = vi
      .fn()
      .mockReturnValueOnce(LOCAL_DOCKER_CONTEXT)
      .mockReturnValue({ status: 0 });

    runPrismaIntegrationTests(
      { TEST_DATABASE_URL: CANONICAL_TEST_DATABASE_URL, PATH: "/usr/bin" },
      { spawn, createTemporaryDirectory, removeTemporaryDirectory },
    );

    expect(createTemporaryDirectory).toHaveBeenCalledOnce();
    expect(
      spawn.mock.calls.every(
        ([, , options]) =>
          options.env.DOCKER_CONFIG === temporaryDirectory && options.env.HOME === temporaryDirectory,
      ),
    ).toBe(true);
    expect(removeTemporaryDirectory).toHaveBeenCalledExactlyOnceWith(temporaryDirectory);
  });

  it("removes the temporary directory when local Docker verification fails", () => {
    const temporaryDirectory = "/tmp/aso-computacion-admin-prisma-test-5678";
    const removeTemporaryDirectory = vi.fn();

    expect(() =>
      runPrismaIntegrationTests(
        { TEST_DATABASE_URL: CANONICAL_TEST_DATABASE_URL },
        {
          createTemporaryDirectory: () => temporaryDirectory,
          removeTemporaryDirectory,
          spawn: vi.fn().mockReturnValue({ status: 0, stdout: "ssh://docker.example.test\n" }),
        },
      ),
    ).toThrow("Docker default context must resolve to a local Unix socket or Windows named pipe.");
    expect(removeTemporaryDirectory).toHaveBeenCalledExactlyOnceWith(temporaryDirectory);
  });

  it("rejects a non-local selected Docker context before any Compose command", () => {
    const spawn = vi.fn().mockReturnValue({ status: 0, stdout: "ssh://docker.example.test\n" });

    expect(() =>
      runPrismaIntegrationTests(
        { TEST_DATABASE_URL: CANONICAL_TEST_DATABASE_URL, PATH: "/usr/bin" },
        { spawn },
      ),
    ).toThrow("Docker default context must resolve to a local Unix socket or Windows named pipe.");
    expect(spawn.mock.calls.map(([, args]) => args)).toEqual([
      LOCAL_DOCKER_CONTEXT_COMMAND,
    ]);
  });

  it("stops later stages and recovers the Compose environment when migration fails", () => {
    const spawn = vi
      .fn()
      .mockReturnValueOnce(LOCAL_DOCKER_CONTEXT)
      .mockReturnValueOnce({ status: 0 })
      .mockReturnValueOnce({ status: 1 })
      .mockReturnValueOnce({ status: 0 });

    expect(() =>
      runPrismaIntegrationTests(
        { TEST_DATABASE_URL: CANONICAL_TEST_DATABASE_URL, PATH: "/usr/bin" },
        { spawn },
      ),
    ).toThrow("Prisma migration failed");
    expect(spawn.mock.calls.map(([, args]) => args)).toEqual([
      LOCAL_DOCKER_CONTEXT_COMMAND,
      [
        "--context",
        "default",
        "compose",
        "--project-name",
        "aso-computacion-admin-prisma-test",
        "-f",
        "docker-compose.test.yml",
        "up",
        "-d",
        "--wait",
      ],
      ["prisma", "migrate", "deploy"],
      [
        "--context",
        "default",
        "compose",
        "--project-name",
        "aso-computacion-admin-prisma-test",
        "-f",
        "docker-compose.test.yml",
        "down",
        "-v",
        "--remove-orphans",
      ],
    ]);
  });

  it("attempts cleanup even when Docker startup reports a failure", () => {
    const spawn = vi
      .fn()
      .mockReturnValueOnce(LOCAL_DOCKER_CONTEXT)
      .mockReturnValueOnce({ status: 1 })
      .mockReturnValueOnce({ status: 0 });

    expect(() =>
      runPrismaIntegrationTests(
        { TEST_DATABASE_URL: CANONICAL_TEST_DATABASE_URL, PATH: "/usr/bin" },
        { spawn },
      ),
    ).toThrow("Docker Compose startup failed");
    expect(spawn.mock.calls.map(([, args]) => args)).toEqual([
      LOCAL_DOCKER_CONTEXT_COMMAND,
      [
        "--context",
        "default",
        "compose",
        "--project-name",
        "aso-computacion-admin-prisma-test",
        "-f",
        "docker-compose.test.yml",
        "up",
        "-d",
        "--wait",
      ],
      [
        "--context",
        "default",
        "compose",
        "--project-name",
        "aso-computacion-admin-prisma-test",
        "-f",
        "docker-compose.test.yml",
        "down",
        "-v",
        "--remove-orphans",
      ],
    ]);
  });

  it("rejects a configured Docker daemon before spawning or scheduling teardown", () => {
    const spawn = vi.fn();

    expect(() =>
      runPrismaIntegrationTests(
        {
          DOCKER_HOST: "ssh://docker.example.test",
          TEST_DATABASE_URL: CANONICAL_TEST_DATABASE_URL,
        },
        { spawn },
      ),
    ).toThrow("DOCKER_HOST must not be configured for Prisma integration tests.");
    expect(spawn).not.toHaveBeenCalled();
  });

  it.each([
    {
      environment: { TEST_DATABASE_URL: undefined },
      message: "TEST_DATABASE_URL must target the isolated Prisma test database.",
    },
    {
      environment: {
        DOCKER_HOST: "ssh://docker.example.test",
        TEST_DATABASE_URL: CANONICAL_TEST_DATABASE_URL,
      },
      message: "DOCKER_HOST must not be configured for Prisma integration tests.",
    },
  ])("removes the temporary directory when setup rejects before Docker runs", ({ environment, message }) => {
    const temporaryDirectory = "/tmp/aso-computacion-admin-prisma-test-pre-run";
    const createTemporaryDirectory = vi.fn().mockReturnValue(temporaryDirectory);
    const removeTemporaryDirectory = vi.fn();
    const spawn = vi.fn();

    expect(() =>
      runPrismaIntegrationTests(environment, {
        createTemporaryDirectory,
        removeTemporaryDirectory,
        spawn,
      }),
    ).toThrow(message);
    expect(createTemporaryDirectory).toHaveBeenCalledOnce();
    expect(removeTemporaryDirectory).toHaveBeenCalledExactlyOnceWith(temporaryDirectory);
    expect(spawn).not.toHaveBeenCalled();
  });

  it("reports a bounded Docker timeout with recovery", () => {
    const spawn = vi
      .fn()
      .mockReturnValueOnce(LOCAL_DOCKER_CONTEXT)
      .mockReturnValueOnce({ error: { code: "ETIMEDOUT" }, status: null })
      .mockReturnValueOnce({ status: 0 });

    expect(() =>
      runPrismaIntegrationTests(
        { TEST_DATABASE_URL: CANONICAL_TEST_DATABASE_URL, PATH: "/usr/bin" },
        { spawn },
      ),
    ).toThrow(/Docker Compose startup timed out after \d+ms/);
    expect(spawn).toHaveBeenCalledTimes(3);
  });

  it("reports a secret-free manual Docker recovery command when teardown fails", () => {
    const spawn = vi
      .fn()
      .mockReturnValueOnce(LOCAL_DOCKER_CONTEXT)
      .mockReturnValueOnce({ status: 0 })
      .mockReturnValueOnce({ status: 0 })
      .mockReturnValueOnce({ status: 0 })
      .mockReturnValueOnce({ status: 1 });

    expect(() =>
      runPrismaIntegrationTests(
        {
          TEST_DATABASE_URL: CANONICAL_TEST_DATABASE_URL,
          PATH: "/usr/bin",
          OTHER_VALUE: "secret-that-must-not-leak",
        },
        { spawn },
      ),
    ).toThrow(
      "Docker Compose cleanup failed (exit status 1). Run `docker compose --project-name aso-computacion-admin-prisma-test -f docker-compose.test.yml down -v --remove-orphans` manually to recover.",
    );
  });

  it("preserves a stage failure while adding the manual recovery command after teardown fails", () => {
    const spawn = vi
      .fn()
      .mockReturnValueOnce(LOCAL_DOCKER_CONTEXT)
      .mockReturnValueOnce({ status: 0 })
      .mockReturnValueOnce({ status: 1 })
      .mockReturnValueOnce({ status: 1 });

    expect(() =>
      runPrismaIntegrationTests(
        { TEST_DATABASE_URL: CANONICAL_TEST_DATABASE_URL, PATH: "/usr/bin" },
        { spawn },
      ),
    ).toThrow(
      "Prisma migration failed (exit status 1). Cleanup also failed: Docker Compose cleanup failed (exit status 1). Run `docker compose --project-name aso-computacion-admin-prisma-test -f docker-compose.test.yml down -v --remove-orphans` manually to recover.",
    );
  });
});
