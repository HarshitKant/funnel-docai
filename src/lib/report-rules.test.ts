import { test } from "node:test";
import assert from "node:assert/strict";
import { extractBeforeAfter, hunchRestatesChange, MAX_HYPOTHESES } from "./report-rules.ts";

test("before/after read from '38% to 30%' when boxes are empty", () => {
  assert.deepEqual(extractBeforeAfter("", "", "Eligibility fell from 38% to 30% over two months"), { before: "38", after: "30" });
});
test("filled boxes win over text", () => {
  assert.deepEqual(extractBeforeAfter("40", "35", "fell from 38% to 30%"), { before: "40", after: "35" });
});
test("hunch that repeats the change is flagged", () => {
  assert.equal(hunchRestatesChange("Eligibility fell from 38% to 30%", "Eligibility fell from 38% to 30% in two months"), true);
});
test("hunch with a cause is not flagged", () => {
  assert.equal(hunchRestatesChange("Eligibility fell because the new bureau check rejects thin-file borrowers", "Eligibility fell from 38% to 30%"), false);
});
test("up to 5 explanations are kept", () => {
  assert.equal(MAX_HYPOTHESES, 5);
});
