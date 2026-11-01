import { describe, expect, test } from "bun:test";
import { computeAccess } from "./access.server";

function clientWithRuns(count: number) {
  const result = { count, data: [] };
  const chain: any = {
    select: () => chain,
    eq: () => chain,
    gte: () => chain,
    order: () => chain,
    limit: () => chain,
    then: (resolve: (value: typeof result) => unknown) => Promise.resolve(result).then(resolve),
  };
  return { from: () => chain } as Parameters<typeof computeAccess>[0];
}

describe("temporary complete-report access", () => {
  test("Free users receive the whole report without buying Pro", async () => {
    const access = await computeAccess(clientWithRuns(0), "user", "sandbox");
    expect(access.plan).toBe("free");
    expect(access.fullReport).toBe(true);
  });

  test("the existing three reports per month limit remains", async () => {
    const access = await computeAccess(clientWithRuns(3), "user", "live");
    expect(access.freeLimit).toBe(3);
    expect(access.runsLeft).toBe(0);
    expect(access.canRun).toBe(false);
  });
});