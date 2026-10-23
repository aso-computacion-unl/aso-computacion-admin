import { HttpError } from "../errors/http-error";

export async function parseBody(request: Request): Promise<unknown> {
  const contentType = request.headers.get("Content-Type") ?? "";

  if (!contentType.toLowerCase().includes("application/json")) {
    throw new HttpError(400, "Content-Type must be application/json");
  }

  try {
    return await request.json();
  } catch {
    throw new HttpError(400, "Request body is required");
  }
}
