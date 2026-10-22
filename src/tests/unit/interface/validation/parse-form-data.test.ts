import { describe, expect, it, vi } from "vitest";

import { HttpError } from "@/interface/errors/http-error";
import { parseFormData } from "@/interface/validation/parse-form-data";

function mockRequest(
  contentType: string,
  formData: FormData | Error,
): Request {
  return {
    headers: new Headers({ "Content-Type": contentType }),
    formData: async () => {
      if (formData instanceof Error) {
        throw formData;
      }

      return formData;
    },
  } as unknown as Request;
}

describe("parseFormData", () => {
  it.each([
    "multipart/form-data; boundary=abc-123",
    'multipart/form-data; boundary="abc-123"',
    'multipart/form-data; boundary="abc 123"',
  ])(
    "returns multipart form data with a valid boundary without interpreting its fields",
    async (contentType) => {
      const formData = new FormData();
      formData.set("file", new File(["image"], "photo.jpg", { type: "image/jpeg" }));

      await expect(parseFormData(mockRequest(contentType, formData))).resolves.toBe(formData);
    },
  );

  it.each([
    "multipart/form-data",
    "multipart/form-data; boundary=",
    "multipart/form-data; boundary=bad boundary",
    "multipart/form-data; boundary=first; boundary=second",
  ])("rejects multipart content types without one valid boundary: %s", async (contentType) => {
    const formData = new FormData();

    await expect(parseFormData(mockRequest(contentType, formData))).rejects.toEqual(
      new HttpError(400, "Content-Type must be multipart/form-data with a valid boundary"),
    );
  });

  it("rejects a non-multipart request before reading form data", async () => {
    await expect(parseFormData(mockRequest("application/json", new FormData()))).rejects.toEqual(
      new HttpError(400, "Content-Type must be multipart/form-data"),
    );
  });

  it("maps form-data parser failures to a safe validation error", async () => {
    const parserError = new Error("unexpected multipart parser internals");

    await expect(
      parseFormData(mockRequest("multipart/form-data; boundary=abc", parserError)),
    ).rejects.toEqual(new HttpError(400, "Multipart form data is required"));
  });
});

describe("parseFormData Content-Length pre-check", () => {
  const MAX_BYTES = 5 * 1024 * 1024;

  function mockRequestWithContentLength(
    contentLength: string | null,
    formData: FormData,
  ): { request: Request; formDataSpy: ReturnType<typeof vi.fn> } {
    const headers = new Headers({ "Content-Type": "multipart/form-data; boundary=abc" });

    if (contentLength !== null) {
      headers.set("Content-Length", contentLength);
    }

    const formDataSpy = vi.fn(async () => formData);

    return {
      request: { headers, formData: formDataSpy } as unknown as Request,
      formDataSpy,
    };
  }

  it("rejects an oversized Content-Length with 413 before reading form data", async () => {
    const { request, formDataSpy } = mockRequestWithContentLength(String(MAX_BYTES + 1), new FormData());

    await expect(parseFormData(request, { maxContentLengthBytes: MAX_BYTES })).rejects.toEqual(
      new HttpError(413, "Request body exceeds the maximum allowed upload size"),
    );
    expect(formDataSpy).not.toHaveBeenCalled();
  });

  it("parses normally when Content-Length is exactly at the ceiling", async () => {
    const formData = new FormData();
    formData.set("file", new File(["image"], "photo.jpg", { type: "image/jpeg" }));
    const { request, formDataSpy } = mockRequestWithContentLength(String(MAX_BYTES), formData);

    await expect(parseFormData(request, { maxContentLengthBytes: MAX_BYTES })).resolves.toBe(formData);
    expect(formDataSpy).toHaveBeenCalledTimes(1);
  });

  it("falls through to normal parsing when Content-Length is absent", async () => {
    const formData = new FormData();
    formData.set("file", new File(["image"], "photo.jpg", { type: "image/jpeg" }));
    const { request, formDataSpy } = mockRequestWithContentLength(null, formData);

    await expect(parseFormData(request, { maxContentLengthBytes: MAX_BYTES })).resolves.toBe(formData);
    expect(formDataSpy).toHaveBeenCalledTimes(1);
  });

  it("does not enforce any ceiling when no options are passed", async () => {
    const formData = new FormData();
    formData.set("file", new File(["image"], "photo.jpg", { type: "image/jpeg" }));
    const { request, formDataSpy } = mockRequestWithContentLength(String(MAX_BYTES * 100), formData);

    await expect(parseFormData(request)).resolves.toBe(formData);
    expect(formDataSpy).toHaveBeenCalledTimes(1);
  });
});
