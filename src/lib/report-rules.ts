// Pure, deterministic report rules (no server imports) — shared by server fn, UI and tests.

const NUM_RE = /-?\d+(?:\.\d+)?/g;

/** Before/after values: the boxes if filled, otherwise the first two numbers typed in "What changed". */
export function extractBeforeAfter(before: string, after: string, change: string): { before: string; after: string } {
  if (/\d/.test(before) && /\d/.test(after)) return { before, after };
  const nums = change.replace(/,/g, "").match(NUM_RE) ?? [];
  if (nums.length >= 2) return { before: nums[0] ?? "", after: nums[1] ?? "" };
  return { before, after };
}

const CAUSE_WORDS = /\b(because|due|caused|cause|since|after|new|rule|rules|change[sd]?|policy|bug|broke|broken|update[sd]?|release[sd]?|launch|vendor|partner|stricter|fail(s|ed|ing|ure)?|error|added|removed|switch(ed)?|migrat\w*|outage|kyc|bureau|price|pricing)\b/i;

/** True when the hunch only restates the change (lots of overlap, no causal words). */
export function hunchRestatesChange(hunch: string, change: string): boolean {
  const h = hunch.trim();
  if (!h || !change.trim()) return false;
  if (CAUSE_WORDS.test(h)) return false;
  const words = (s: string) => new Set(s.toLowerCase().split(/[^a-z0-9%]+/).filter((w) => w.length > 2));
  const hw = words(h), cw = words(change);
  if (!hw.size) return false;
  const shared = [...hw].filter((w) => cw.has(w)).length;
  return shared / hw.size >= 0.4;
}

export const MAX_HYPOTHESES = 5;
