import path from "node:path";

/**
 * Extracts the console output section relevant to a specific spec file.
 * Useful when 'lastTestOutput' contains output from multiple specs (e.g. "Run All").
 * 
 * Strategy:
 * 1. Find the "FAIL ... <specFileName>" marker.
 * 2. Capture text until the next "FAIL", "PASS", or end of output.
 * 
 * @param fullOutput The complete console output (ANSI codes stripped or not, but matching depends on it. Ideally stripped.)
 * @param specRelPath Relative path to the spec file (e.g. "libs/my-lib/src/my.spec.ts")
 * @returns The extracted output block, or null if not found.
 */
export function extractSpecFailureOutput(
  fullOutput: string,
  specRelPath: string
): string | null {
  // Jest output typically lines up like:
  //  FAIL  path/to/my.spec.ts
  // or
  //  FAIL  path/to/my.spec.ts (5.123 s)
  
  // We'll search for the filename first, as the path prefix format varies by runner/config.
  const filename = path.basename(specRelPath);
  
  // Normalize content for searching (searching blindly for the path might fail if formatting differs)
  // We look for "FAIL" followed by something ending in the filename
  // Regex: ^\s*FAIL\s+.*my\.spec\.ts
  
  const escapeRegExp = (string: string) => string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const filenameEscaped = escapeRegExp(filename);
  
  // Pattern: Start of line (multiline), whitespace, FAIL, whitespace, anything, filename, end of line or space
  // Note: ansi codes should be stripped before calling this, or we need to handle them.
  // We assume stripped input for simplicity and robustness.
  const startRegex = new RegExp(`^\\s*FAIL\\s+.*${filenameEscaped}.*$`, "m");
  
  const match = startRegex.exec(fullOutput);
  if (!match) {
    return null;
  }
  
  const startIndex = match.index;
  const followingText = fullOutput.slice(startIndex + match[0].length);
  
  // Find the next test file marker (PASS or FAIL) to end the block
  // Pattern: ^\s*(PASS|FAIL)\s+
  // But be careful not to match the current line again if we didn't advance enough (we did slice)
  const nextMarkerRegex = /^\s*(PASS|FAIL)\s+/m;
  const nextMatch = nextMarkerRegex.exec(followingText);
  
  let endIndex = followingText.length;
  if (nextMatch) {
    endIndex = nextMatch.index;
  } else {
    // If no next file, look for "Test Suites:" summary which usually marks the end of test details
    const summaryRegex = /^\s*Test Suites:\s+/m;
    const summaryMatch = summaryRegex.exec(followingText);
    if (summaryMatch) {
      endIndex = summaryMatch.index;
    }
  }
  
  // Reconstruct the block
  const block = fullOutput.slice(startIndex, startIndex + match[0].length + endIndex);
  
  return block.trim();
}

