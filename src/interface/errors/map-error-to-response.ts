import { NextResponse } from "next/server";
import { ZodError, type z } from "zod";

import { NotFoundError } from "@/application/use-cases/use-case-error";
import {
  ImageTooLargeError,
  ImageTooSmallError,
  InvalidImageFormatError,
  ValidationError,
} from "@/domain";

import { HttpError } from "./http-error";

// Stable, safe codes for image rejections: the client switches on `error`
// and `message` never echoes domain-error text.
const IMAGE_ERROR = {
  IMAGE_TOO_LARGE: "IMAGE_TOO_LARGE",
  IMAGE_TOO_SMALL: "IMAGE_TOO_SMALL",
  INVALID_IMAGE_FORMAT: "INVALID_IMAGE_FORMAT",
} as const;

function imageErrorResponse(error: string, message: string): NextResponse {
  return NextResponse.json({ error, message }, { status: 400 });
}

export function formatZodIssue(issue: z.core.$ZodIssue): string {
  if (issue.code === "unrecognized_keys") {
    return `Unknown field: ${issue.keys[0]}`;
  }

  const field = issue.path[0];

  if (field === "page") {
    return issue.code === "too_big" ? "page must be between 1 and 100000" : "page must be a positive integer";
  }

  if (field === "limit") {
    return "limit must be between 1 and 100";
  }

  if (field === "id" && issue.code === "invalid_format" && issue.format === "uuid") {
    return "id must be a valid UUID";
  }

  return issue.message;
}

export function mapErrorToResponse(error: unknown): NextResponse {
  if (error instanceof ZodError) {
    return NextResponse.json({ error: formatZodIssue(error.issues[0]!) }, { status: 400 });
  }

  if (error instanceof InvalidImageFormatError) {
    return imageErrorResponse(IMAGE_ERROR.INVALID_IMAGE_FORMAT, "Image must be a JPEG, PNG or WebP file.");
  }

  if (error instanceof ImageTooLargeError) {
    return imageErrorResponse(IMAGE_ERROR.IMAGE_TOO_LARGE, "Image size must not exceed 5 MB.");
  }

  if (error instanceof ImageTooSmallError) {
    return imageErrorResponse(IMAGE_ERROR.IMAGE_TOO_SMALL, `Image must be at least ${error.minWidth} px wide.`);
  }

  if (error instanceof ValidationError) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }

  if (error instanceof NotFoundError) {
    return NextResponse.json({ error: error.message }, { status: 404 });
  }

  if (error instanceof HttpError) {
    return NextResponse.json({ error: error.message }, { status: error.statusCode });
  }

  console.error(error);

  return NextResponse.json({ error: "Internal server error" }, { status: 500 });
}
