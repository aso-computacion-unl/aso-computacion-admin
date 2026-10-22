import { NextResponse } from "next/server";
import { ZodError, type z } from "zod";

import { NotFoundError } from "@/application/use-cases/use-case-error";
import { ValidationError } from "@/domain";

import { HttpError } from "./http-error";

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
