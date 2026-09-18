import { describe, expect, it } from "vitest";

import { buildCapabilityReport, unsupported, UnsupportedCapabilityError } from "./capabilities";

describe("buildCapabilityReport", () => {
  it("reports feed-mode capabilities, including a truncated content mode", () => {
    expect(buildCapabilityReport("feed", { fullContent: false })).toEqual({
      mode: "feed",
      pages: false,
      commentHistory: true,
      richImages: false,
      authorBio: false,
      fullContent: false,
    });
  });

  it("assumes full content in feed mode when nothing was detected yet", () => {
    expect(buildCapabilityReport("feed").fullContent).toBe(true);
  });

  it("reports api-mode capabilities", () => {
    expect(buildCapabilityReport("api")).toEqual({
      mode: "api",
      pages: true,
      commentHistory: true,
      richImages: true,
      authorBio: false,
      fullContent: true,
    });
  });
});

describe("unsupported", () => {
  it("throws a typed error naming the feature", () => {
    expect(() => unsupported("pages")).toThrow(UnsupportedCapabilityError);

    try {
      unsupported("pages");
    } catch (error) {
      expect(error).toBeInstanceOf(UnsupportedCapabilityError);
      if (error instanceof UnsupportedCapabilityError) {
        expect(error.feature).toBe("pages");
      }
    }
  });
});
