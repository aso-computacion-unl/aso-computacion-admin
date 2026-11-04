import { HttpError } from "../errors/http-error";

const BOUNDARY_TOKEN_PATTERN = /^[A-Za-z0-9'()+_,./:=?\-]{1,70}$/u;
const QUOTED_BOUNDARY_PATTERN = /^(?:[A-Za-z0-9'()+_,./:=?\-]|[A-Za-z0-9'()+_,./:=?\-][A-Za-z0-9'()+_,./:=?\- ]{0,68}[A-Za-z0-9'()+_,./:=?\-])$/u;

const LINE_TERMINATOR = /[\n\r\u2028\u2029]/;

/**
 * The value of a `boundary=` parameter, or null when the parameter is anything else (or has no value).
 * The value is what `boundary\s*=\s*(.+?)\s*$` captures: the text between the surrounding whitespace, which
 * cannot hold a line terminator; a value of only whitespace is its last character that is not a terminator.
 * Written as a scan because that pattern backtracks on a long run of whitespace.
 */
function boundaryParameterValue(parameter: string): string | null {
  const name = parameter.trimStart();

  if (name.slice(0, "boundary".length).toLowerCase() !== "boundary") {
    return null;
  }

  const afterName = name.slice("boundary".length).trimStart();

  if (!afterName.startsWith("=")) {
    return null;
  }

  const rest = afterName.slice(1);
  const value = rest.trim();

  if (value !== "") {
    return LINE_TERMINATOR.test(value) ? null : value;
  }

  return Array.from(rest).findLast((character) => !LINE_TERMINATOR.test(character)) ?? null;
}

function hasValidMultipartBoundary(contentType: string): boolean {
  const [mediaType, ...parameters] = contentType.split(";");

  if (mediaType?.trim().toLowerCase() !== "multipart/form-data") {
    return false;
  }

  const boundaries = parameters.flatMap((parameter) => {
    const value = boundaryParameterValue(parameter);

    if (value === null) {
      return [];
    }

    const isQuoted = value.startsWith('"') && value.endsWith('"');

    return [{ value: isQuoted ? value.slice(1, -1) : value, isQuoted }];
  });

  const boundary = boundaries[0];

  if (boundaries.length !== 1 || !boundary) {
    return false;
  }

  return boundary.isQuoted
    ? QUOTED_BOUNDARY_PATTERN.test(boundary.value)
    : BOUNDARY_TOKEN_PATTERN.test(boundary.value);
}

export interface ParseFormDataOptions {
  /**
   * When set, rejects the request before reading any body bytes if the
   * declared `Content-Length` exceeds this ceiling. A missing or malformed
   * header falls through unchecked here — callers that enforce a real limit
   * still get the post-parse size validation as a backstop.
   */
  readonly maxContentLengthBytes?: number;
}

export async function parseFormData(
  request: Request,
  options?: ParseFormDataOptions,
): Promise<FormData> {
  const maxContentLengthBytes = options?.maxContentLengthBytes;

  if (maxContentLengthBytes !== undefined) {
    const contentLengthHeader = request.headers.get("Content-Length");
    const contentLength = contentLengthHeader === null ? Number.NaN : Number(contentLengthHeader);

    if (Number.isFinite(contentLength) && contentLength > maxContentLengthBytes) {
      throw new HttpError(413, "Request body exceeds the maximum allowed upload size");
    }
  }

  const contentType = request.headers.get("Content-Type") ?? "";

  if (!contentType.toLowerCase().includes("multipart/form-data")) {
    throw new HttpError(400, "Content-Type must be multipart/form-data");
  }

  if (!hasValidMultipartBoundary(contentType)) {
    throw new HttpError(400, "Content-Type must be multipart/form-data with a valid boundary");
  }

  try {
    return await request.formData();
  } catch {
    throw new HttpError(400, "Multipart form data is required");
  }
}
