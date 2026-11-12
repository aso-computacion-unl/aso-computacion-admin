import { mkdirSync, renameSync, writeFileSync } from "node:fs";
import { createServer, type Server, type Socket } from "node:net";
import { join } from "node:path";

/*
 * A tiny SMTP server for the e2e suite: it accepts every message and writes it to a directory, so a spec can read
 * the confirmation link from the email instead of signing the token itself (e2e/support/mail-sink.ts reads them).
 * `scripts/run-e2e.mjs` starts it and points the app's `MAIL_SMTP_*` at it. Plain text, no TLS, any login accepted;
 * it only listens on 127.0.0.1. Node runs this file as is (types are stripped), so it uses no TypeScript-only syntax.
 */

/** The port the app under test sends to (`MAIL_SMTP_PORT`). */
export const E2E_SMTP_PORT = 3125;

/** One received message as it is stored: the envelope and the raw MIME text. */
export interface SinkMessage {
  from: string;
  to: string[];
  raw: string;
}

const address = (argument: string) => /<([^>]*)>/.exec(argument)?.[1] ?? argument.trim();

function handleConnection(socket: Socket, save: (message: SinkMessage) => void) {
  let buffer = "";
  let data: string[] | undefined;
  let from = "";
  let to: string[] = [];
  // AUTH LOGIN asks for the user name and then the password: two lines that are swallowed.
  let loginSteps = 0;

  const reply = (line: string) => socket.write(`${line}\r\n`);

  const command = (line: string) => {
    const [verb = "", ...rest] = line.trim().split(/\s+/);
    const argument = rest.join(" ");

    switch (verb.toUpperCase()) {
      case "EHLO":
        return reply("250-e2e-sink\r\n250-AUTH PLAIN LOGIN\r\n250 8BITMIME");
      case "HELO":
        return reply("250 e2e-sink");
      case "AUTH":
        if (/^LOGIN$/i.test(rest[0] ?? "") && rest.length === 1) {
          loginSteps = 2;

          return reply("334 VXNlcm5hbWU6");
        }

        return reply("235 2.7.0 Accepted");
      case "MAIL":
        from = address(argument);
        to = [];

        return reply("250 OK");
      case "RCPT":
        to.push(address(argument));

        return reply("250 OK");
      case "DATA":
        data = [];

        return reply("354 End data with <CR><LF>.<CR><LF>");
      case "RSET":
        from = "";
        to = [];

        return reply("250 OK");
      case "NOOP":
        return reply("250 OK");
      case "QUIT":
        reply("221 Bye");

        return socket.end();
      default:
        return reply("502 Command not implemented");
    }
  };

  const line = (text: string) => {
    if (data) {
      if (text === ".") {
        save({ from, to, raw: data.join("\r\n") });
        data = undefined;

        return reply("250 OK queued");
      }

      // Dot-stuffing: a line that starts with a dot had another one added.
      return void data.push(text.startsWith("..") ? text.slice(1) : text);
    }

    if (loginSteps > 0) {
      loginSteps -= 1;

      return reply(loginSteps === 1 ? "334 UGFzc3dvcmQ6" : "235 2.7.0 Accepted");
    }

    return command(text);
  };

  socket.setEncoding("utf8");
  socket.on("data", (chunk: string) => {
    buffer += chunk;

    for (let end = buffer.indexOf("\r\n"); end !== -1; end = buffer.indexOf("\r\n")) {
      const text = buffer.slice(0, end);

      buffer = buffer.slice(end + 2);
      line(text);
    }
  });
  // A client that goes away mid-message is its own problem: the sink must not crash the test run.
  socket.on("error", () => undefined);
  reply("220 e2e-sink ESMTP ready");
}

/** Starts the sink on 127.0.0.1 and resolves once it listens. Each message lands in `directory` as `<number>.json`. */
export function startSmtpSink({ directory, port = E2E_SMTP_PORT }: { directory: string; port?: number }): Promise<{ port: number; close(): Promise<void> }> {
  mkdirSync(directory, { recursive: true });

  let count = 0;
  const save = (message: SinkMessage) => {
    count += 1;

    // Written under another name and renamed, so a reader never sees half a file.
    const target = join(directory, `${String(count).padStart(6, "0")}.json`);

    writeFileSync(`${target}.tmp`, JSON.stringify(message));
    renameSync(`${target}.tmp`, target);
  };
  const sockets = new Set<Socket>();
  const server: Server = createServer((socket) => {
    sockets.add(socket);
    socket.on("close", () => sockets.delete(socket));
    handleConnection(socket, save);
  });

  return new Promise((resolve, reject) => {
    server.once("error", reject);
    server.listen(port, "127.0.0.1", () => {
      const listening = server.address();

      resolve({
        port: typeof listening === "object" && listening ? listening.port : port,
        close: () =>
          new Promise<void>((done) => {
            for (const socket of sockets) socket.destroy();
            server.close(() => done());
          }),
      });
    });
  });
}
