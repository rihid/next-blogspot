import { describe, expect, it } from "vitest";

import { createFixedWindowLimiter } from "./rate-limit";

describe("createFixedWindowLimiter", () => {
  it("allows up to the limit and then blocks", () => {
    const limiter = createFixedWindowLimiter({ limit: 3, windowMs: 1000 });

    expect(limiter.check("a")).toBe(true);
    expect(limiter.check("a")).toBe(true);
    expect(limiter.check("a")).toBe(true);
    expect(limiter.check("a")).toBe(false);
  });

  it("tracks keys independently", () => {
    const limiter = createFixedWindowLimiter({ limit: 1, windowMs: 1000 });

    expect(limiter.check("a")).toBe(true);
    expect(limiter.check("b")).toBe(true);
    expect(limiter.check("a")).toBe(false);
  });

  it("resets once the window elapses", async () => {
    const limiter = createFixedWindowLimiter({ limit: 1, windowMs: 10 });

    expect(limiter.check("a")).toBe(true);
    await new Promise((resolve) => setTimeout(resolve, 20));
    expect(limiter.check("a")).toBe(true);
  });
});
