import { describe, expect, it } from "vitest";

import { DEFAULT_REVALIDATE_TTL, resolveRevalidateTtl } from "./config";

describe("resolveRevalidateTtl", () => {
  it("falls back to the default when unset", () => {
    expect(resolveRevalidateTtl(undefined)).toBe(DEFAULT_REVALIDATE_TTL);
  });

  it("falls back to the default when empty or whitespace", () => {
    expect(resolveRevalidateTtl("")).toBe(DEFAULT_REVALIDATE_TTL);
    expect(resolveRevalidateTtl("   ")).toBe(DEFAULT_REVALIDATE_TTL);
  });

  it("parses a valid positive integer", () => {
    expect(resolveRevalidateTtl("900")).toBe(900);
  });

  it("floors fractional values", () => {
    expect(resolveRevalidateTtl("90.9")).toBe(90);
  });

  it("rejects non-numeric, zero, and negative values", () => {
    expect(resolveRevalidateTtl("soon")).toBe(DEFAULT_REVALIDATE_TTL);
    expect(resolveRevalidateTtl("0")).toBe(DEFAULT_REVALIDATE_TTL);
    expect(resolveRevalidateTtl("-30")).toBe(DEFAULT_REVALIDATE_TTL);
  });

  it("rejects Infinity", () => {
    expect(resolveRevalidateTtl("Infinity")).toBe(DEFAULT_REVALIDATE_TTL);
  });
});
