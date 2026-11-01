import { describe, test } from "node:test";
import { strict as assert } from "node:assert";
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
  return { from: () => chain } as unknown as Parameters<typeof computeAccess>[0];
}

describe("temporary complete-report access", () => {
  test("Free users receive the whole report without buying Pro", async () => {
    const access = await computeAccess(clientWithRuns(0), "user", "sandbox");
    assert.equal(access.plan, "free");
    assert.equal(access.fullReport, true);
  });

  test("the existing three reports per month limit remains", async () => {
    const access = await computeAccess(clientWithRuns(3), "user", "live");
    assert.equal(access.freeLimit, 3);
    assert.equal(access.runsLeft, 0);
    assert.equal(access.canRun, false);
  });
});