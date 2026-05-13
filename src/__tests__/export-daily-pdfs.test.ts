import test from "node:test";
import assert from "node:assert/strict";
import { isSupportedDailyMarkdown } from "../export-daily-pdfs.js";

test("isSupportedDailyMarkdown keeps only current-contract artifacts", () => {
  const date = "2026-05-13";

  assert.equal(isSupportedDailyMarkdown(`deep-daily-${date}.md`, date), true);
  assert.equal(isSupportedDailyMarkdown("market-structure.md", date), true);
  assert.equal(isSupportedDailyMarkdown("movers-all.md", date), true);
  assert.equal(
    isSupportedDailyMarkdown("deep-case-study-fed-sep-2025.md", date),
    true,
  );

  assert.equal(isSupportedDailyMarkdown("deep-daily.md", date), false);
  assert.equal(isSupportedDailyMarkdown("movers-politics.md", date), false);
  assert.equal(isSupportedDailyMarkdown("random-note.md", date), false);
});
