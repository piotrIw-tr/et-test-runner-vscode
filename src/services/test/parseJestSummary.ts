import type { JestTestCounts } from "../cache/specRunCache.js";

export function parseJestTestCounts(
  output: string
): JestTestCounts | undefined {
  // Find the last "Tests:" line (Jest usually prints a summary at end).
  const lines = output.split("\n").map((l) => l.trim());
  const testsLines = lines.filter((l) => l.startsWith("Tests:"));
  const last = testsLines.at(-1);
  if (!last) return undefined;

  // Example:
  // Tests:       45 passed, 2 failed, 1 skipped, 48 total
  // Order can vary; parse pairs.
  const counts: JestTestCounts = {};

  const pairRe = /(\d+)\s+(passed|failed|skipped|total)\b/g;
  let m: RegExpExecArray | null;
  while ((m = pairRe.exec(last)) !== null) {
    const n = Number(m[1]);
    const k = m[2];
    if (k === "passed") counts.passed = n;
    else if (k === "failed") counts.failed = n;
    else if (k === "skipped") counts.skipped = n;
    else if (k === "total") counts.total = n;
  }

  // If we didn't parse anything useful, return undefined.
  if (
    counts.passed === undefined &&
    counts.failed === undefined &&
    counts.skipped === undefined &&
    counts.total === undefined
  ) {
    return undefined;
  }

  return counts;
}

/**
 * Parse the Test Suites line from Jest output.
 * This is useful for detecting compilation errors where Tests: shows 0 total
 * but Test Suites shows failures.
 * 
 * Example: "Test Suites: 1 failed, 1 total"
 */
export function parseJestSuiteCounts(
  output: string
): { passed: number; failed: number; total: number } | undefined {
  const lines = output.split("\n").map((l) => l.trim());
  const suiteLines = lines.filter((l) => l.startsWith("Test Suites:"));
  const last = suiteLines.at(-1);
  if (!last) return undefined;

  const counts = { passed: 0, failed: 0, total: 0 };

  const pairRe = /(\d+)\s+(passed|failed|total)\b/g;
  let m: RegExpExecArray | null;
  while ((m = pairRe.exec(last)) !== null) {
    const n = Number(m[1]);
    const k = m[2];
    if (k === "passed") counts.passed = n;
    else if (k === "failed") counts.failed = n;
    else if (k === "total") counts.total = n;
  }

  if (counts.total === 0) {
    return undefined;
  }

  return counts;
}

