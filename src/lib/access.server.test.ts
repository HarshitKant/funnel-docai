import { describe, test } from "node:test";
import { strict as assert } from "node:assert";
import { computeAccess } from "./access.server";

const anyClient = {} as unknown as Parameters<typeof computeAccess>[0];

describe("free model (payments parked)", () => {
  test("every user can run reports with no monthly limit", async () => {
    const access = await computeAccess(anyClient, "user", "sandbox");
    assert.equal(access.plan, "free");
    assert.equal(access.canRun, true);
    assert.equal(access.runsLeft, Infinity);
  });

  test("every user receives the complete report", async () => {
    const access = await computeAccess(anyClient, "user", "live");
    assert.equal(access.fullReport, true);
  });
});
