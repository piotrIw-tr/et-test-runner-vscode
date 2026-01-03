import fs from "node:fs";
import path from "node:path";
import type { JestTestCounts, SpecRunMetrics } from "../cache/specRunCache.js";

interface JestResultTest {
  name: string;
  duration: number;
  status: string; // "passed" | "failed" | "pending" | "skipped"
  filePath: string;
  failureMessages?: string[];
}

interface JestResultFile {
  results: {
    summary: {
      tests: number;
      passed: number;
      failed: number;
      pending: number;
      skipped: number;
      start: number;
      stop: number;
    };
    tests: JestResultTest[];
  };
}

export interface FailingTestInfo {
  testName: string;
  failureMessage?: string;
}

export interface SpecFailureDetails {
  specAbsPath: string;
  failingTests: FailingTestInfo[];
  totalFailed: number;
  totalPassed: number;
}

export interface PerFileMetrics {
  [relPath: string]: SpecRunMetrics;
}

/**
 * Parse the json-result.json file and return per-file metrics.
 * @param workspaceRoot The workspace root directory
 * @param projectRootRel The project root relative to workspace (e.g., "libs/wallet/commands")
 * @returns A map of relative spec paths to their metrics, or null if not found
 */
export function parseJestResultsFile(
  workspaceRoot: string,
  projectRootRel: string
): PerFileMetrics | null {
  const resultPath = path.join(
    workspaceRoot,
    "dist",
    "reports",
    projectRootRel,
    "json-result.json"
  );

  try {
    const raw = fs.readFileSync(resultPath, "utf8");
    const data = JSON.parse(raw) as JestResultFile;

    if (!data.results?.tests) {
      return null;
    }

    // Group tests by file
    const byFile = new Map<
      string,
      { passed: number; failed: number; skipped: number; totalDurationMs: number }
    >();

    for (const test of data.results.tests) {
      const filePath = test.filePath;
      if (!filePath) continue;

      const existing = byFile.get(filePath) ?? {
        passed: 0,
        failed: 0,
        skipped: 0,
        totalDurationMs: 0,
      };

      if (test.status === "passed") {
        existing.passed++;
      } else if (test.status === "failed") {
        existing.failed++;
      } else if (test.status === "pending" || test.status === "skipped") {
        existing.skipped++;
      }
      existing.totalDurationMs += test.duration ?? 0;

      byFile.set(filePath, existing);
    }

    // Convert to SpecRunMetrics
    const result: PerFileMetrics = {};
    const now = new Date().toISOString();

    for (const [absPath, counts] of byFile.entries()) {
      const relPath = path.relative(workspaceRoot, absPath).split(path.sep).join("/");
      const total = counts.passed + counts.failed + counts.skipped;
      const jest: JestTestCounts = {
        passed: counts.passed,
        failed: counts.failed,
        skipped: counts.skipped,
        total,
      };
      result[relPath] = {
        lastRunIso: now,
        exitCode: counts.failed > 0 ? 1 : 0,
        durationMs: counts.totalDurationMs,
        jest,
      };
    }

    return result;
  } catch {
    return null;
  }
}

/**
 * Get failure details for a specific spec file from json-result.json.
 * @param workspaceRoot The workspace root directory
 * @param projectRootRel The project root relative to workspace
 * @param specAbsPath The absolute path to the spec file
 * @returns Failure details or null if not found/no failures
 */
export function getSpecFailureDetails(
  workspaceRoot: string,
  projectRootRel: string,
  specAbsPath: string
): SpecFailureDetails | null {
  const resultPath = path.join(
    workspaceRoot,
    "dist",
    "reports",
    projectRootRel,
    "json-result.json"
  );

  try {
    const raw = fs.readFileSync(resultPath, "utf8");
    const data = JSON.parse(raw) as JestResultFile;

    if (!data.results?.tests) {
      return null;
    }

    // Normalize paths for comparison
    const normalizedSpecPath = specAbsPath.split(path.sep).join("/");

    // Find tests for this spec file
    const testsForSpec = data.results.tests.filter((t) => {
      const normalizedTestPath = t.filePath?.split(path.sep).join("/");
      return normalizedTestPath === normalizedSpecPath;
    });

    if (testsForSpec.length === 0) {
      return null;
    }

    const failingTests: FailingTestInfo[] = [];
    let totalPassed = 0;
    let totalFailed = 0;

    for (const test of testsForSpec) {
      if (test.status === "passed") {
        totalPassed++;
      } else if (test.status === "failed") {
        totalFailed++;
        failingTests.push({
          testName: test.name,
          failureMessage: test.failureMessages?.join("\n"),
        });
      }
    }

    if (totalFailed === 0) {
      return null;
    }

    return {
      specAbsPath,
      failingTests,
      totalFailed,
      totalPassed,
    };
  } catch {
    return null;
  }
}

