import { describe, expect, it } from "vitest";

import { thumbnailUrl } from "@/lib/cloudinary-thumbnail";

const BASE = "https://res.cloudinary.com/demo/image/upload";

describe("thumbnailUrl", () => {
  it("limits the width to twice the display width, keeping the aspect ratio", () => {
    expect(thumbnailUrl(`${BASE}/v1700000000/aso/events/photo.jpg`, 320)).toBe(
      `${BASE}/w_640,c_limit,f_auto,q_auto/v1700000000/aso/events/photo.jpg`,
    );
  });

  it("fills a box of twice the display size when a height is given", () => {
    expect(thumbnailUrl(`${BASE}/v1700000000/aso/board/p.jpg`, 64, 64)).toBe(
      `${BASE}/w_128,h_128,c_fill,f_auto,q_auto/v1700000000/aso/board/p.jpg`,
    );
  });

  it("rounds the doubled size to whole pixels", () => {
    expect(thumbnailUrl(`${BASE}/v1/a.jpg`, 96.4, 72.3)).toContain("/w_193,h_145,c_fill,");
  });

  it("adds the transformation after an existing one, so the resize is applied last", () => {
    expect(thumbnailUrl(`${BASE}/c_crop,w_900,h_600/v1700000000/aso/a.jpg`, 100)).toBe(
      `${BASE}/c_crop,w_900,h_600/w_200,c_limit,f_auto,q_auto/v1700000000/aso/a.jpg`,
    );
  });

  it("adds the transformation right after upload when the URL has no version", () => {
    expect(thumbnailUrl(`${BASE}/aso/a.jpg`, 100)).toBe(`${BASE}/w_200,c_limit,f_auto,q_auto/aso/a.jpg`);
  });

  it("returns a non-Cloudinary URL unchanged", () => {
    const url = "https://example.com/image/upload/v1/a.jpg";

    expect(thumbnailUrl(url, 100)).toBe(url);
  });

  it("returns a Cloudinary URL that is not an image delivery unchanged", () => {
    const video = "https://res.cloudinary.com/demo/video/upload/v1/a.mp4";

    expect(thumbnailUrl(video, 100)).toBe(video);
  });

  it("returns a local preview URL unchanged", () => {
    expect(thumbnailUrl("blob:http://localhost:3000/1234", 100)).toBe("blob:http://localhost:3000/1234");
  });

  it("does not trust a Cloudinary host that is only a suffix of another host", () => {
    const url = "https://res.cloudinary.com.evil.test/demo/image/upload/v1/a.jpg";

    expect(thumbnailUrl(url, 100)).toBe(url);
  });

  it.each([0, -10, Number.NaN, Number.POSITIVE_INFINITY])("returns the URL unchanged for the width %s", (width) => {
    const url = `${BASE}/v1/a.jpg`;

    expect(thumbnailUrl(url, width)).toBe(url);
  });
});
