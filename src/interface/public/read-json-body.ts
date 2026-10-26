export type JsonBodyResult = { ok: true; value: Record<string, unknown> } | { ok: false; status: 400 | 413 | 415 };

/**
 * Reads a small JSON object from an untrusted request: JSON content type only, never more than `maxBytes`
 * (read as a stream and cut off, so a huge body is not buffered), and an object at the top level.
 */
export async function readJsonObject(request: Request, maxBytes: number): Promise<JsonBodyResult> {
  if (!request.headers.get("content-type")?.toLowerCase().startsWith("application/json")) {
    return { ok: false, status: 415 };
  }

  const declared = Number(request.headers.get("content-length"));

  if (Number.isFinite(declared) && declared > maxBytes) {
    return { ok: false, status: 413 };
  }

  const reader = request.body?.getReader();
  const chunks: Uint8Array[] = [];
  let size = 0;

  while (reader) {
    const { done, value } = await reader.read();

    if (done) break;

    size += value.byteLength;

    if (size > maxBytes) {
      await reader.cancel();

      return { ok: false, status: 413 };
    }

    chunks.push(value);
  }

  try {
    const parsed: unknown = JSON.parse(Buffer.concat(chunks).toString("utf8"));

    return parsed !== null && typeof parsed === "object" && !Array.isArray(parsed)
      ? { ok: true, value: parsed as Record<string, unknown> }
      : { ok: false, status: 400 };
  } catch {
    return { ok: false, status: 400 };
  }
}
