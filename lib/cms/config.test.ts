import { describe, expect, it } from "vitest";

import {
  DEFAULT_PRERENDER_POST_LIMIT,
  DEFAULT_REVALIDATE_TTL,
  resolvePrerenderLimit,
  resolveRevalidateTtl,
} from "./config";

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

describe("resolvePrerenderLimit", () => {
  it("falls back to the default when unset or invalid", () => {
    expect(resolvePrerenderLimit(undefined)).toBe(DEFAULT_PRERENDER_POST_LIMIT);
    expect(resolvePrerenderLimit("")).toBe(DEFAULT_PRERENDER_POST_LIMIT);
    expect(resolvePrerenderLimit("-5")).toBe(DEFAULT_PRERENDER_POST_LIMIT);
    expect(resolvePrerenderLimit("lots")).toBe(DEFAULT_PRERENDER_POST_LIMIT);
  });

  it("accepts zero and positive integers", () => {
    expect(resolvePrerenderLimit("0")).toBe(0);
    expect(resolvePrerenderLimit("100")).toBe(100);
  });
});
