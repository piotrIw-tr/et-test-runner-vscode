import fs from "node:fs";
import path from "node:path";

// Extension root is stored here when the extension activates
let extensionRoot: string | null = null;

export function setExtensionRoot(root: string): void {
  extensionRoot = root;
}

export type AiAssistAction = "fix" | "write" | "refactor";

export interface TestFailureContext {
  /** Absolute path to the failing spec file */
  specAbsPath: string;
  /** Project name in Nx workspace */
  projectName: string;
  /** Workspace root directory */
  workspaceRoot: string;
  /** What action the AI should take */
  action: AiAssistAction;
  /** Error message from Jest (for "fix" action) */
  errorMessage?: string;
  /** Stack trace from Jest (for "fix" action) */
  stackTrace?: string;
  /** Specific failing test name(s) (for "fix" action) */
  failingTestNames?: string[];
  /** Line number of the first error */
  errorLineNumber?: number;
  /** Related source file paths (absolute) */
  relatedSourceFiles?: string[];
  /** Console output from the test run */
  consoleOutput?: string;
}

export interface GeneratedContext {
  /** Path where the context file was written */
  contextFilePath: string;
  /** The test command to run */
  testCommand: string;
  /** Spec file path relative to workspace */
  specRelPath: string;
  /** The full markdown content (for clipboard) */
  markdown: string;
}

/**
 * Generates a markdown context file for AI-assisted test operations.
 * The file is written to .cursor/test-context.md in the workspace root.
 */
export async function generateTestContext(
  ctx: TestFailureContext
): Promise<GeneratedContext> {
  const specRelPath = path
    .relative(ctx.workspaceRoot, ctx.specAbsPath)
    .split(path.sep)
    .join("/");

  const specFileName = path.basename(ctx.specAbsPath);
  const testCommand = `npx nx test ${ctx.projectName} --testFile=${specFileName}`;

  // Build context optimized for Cursor AI with @ references
  const sections: string[] = [];

  // Action-specific header
  let taskSection: string;
  
  if (ctx.action === "fix") {
    taskSection = `# Fix Failing Tests

Fix the failing test(s) in the referenced spec file.`;
  } else if (ctx.action === "write") {
    taskSection = `# Write New Tests

Add new test cases to the referenced spec file. Cover:
- Untested scenarios and edge cases
- Error handling paths
- Boundary conditions`;
  } else {
    taskSection = `# Refactor Tests

Improve the tests in the referenced spec file:
- Simplify complex test setups
- Remove duplication  
- Improve test names and descriptions
- Follow AAA pattern (Arrange-Act-Assert)`;
  }

  sections.push(`${taskSection}

## Files to Read

@.cursor/rules/jest-testing.mdc
@${specRelPath}

## Project Info

| Property | Value |
|----------|-------|
| Project | \`${ctx.projectName}\` |
| Spec | \`${specFileName}\` |
| Path | \`${specRelPath}\` |

## Test Command

\`\`\`bash
${testCommand}
\`\`\`
`);

  // Include error details for "fix" action
  if (ctx.action === "fix") {
    if (ctx.failingTestNames && ctx.failingTestNames.length > 0) {
      sections.push(`## Failing Tests

${ctx.failingTestNames.map((name) => `- \`${name}\``).join("\n")}
`);
    }

    if (ctx.errorMessage) {
      sections.push(`## Error Details

\`\`\`
${ctx.errorMessage}
\`\`\`
`);
    }

    if (ctx.stackTrace) {
      sections.push(`## Stack Trace

\`\`\`
${ctx.stackTrace}
\`\`\`
`);
    }

    if (ctx.consoleOutput) {
      sections.push(`## Console Output

\`\`\`
${ctx.consoleOutput}
\`\`\`
`);
    }

    // If no error details available, note that
    if (!ctx.failingTestNames?.length && !ctx.errorMessage && !ctx.stackTrace && !ctx.consoleOutput) {
      sections.push(`## Note

No detailed error information available. Run the test command to see current failures.
`);
    }
  }

  // Add related source files if available
  if (ctx.relatedSourceFiles && ctx.relatedSourceFiles.length > 0) {
    const relPaths = ctx.relatedSourceFiles.map(f => 
      path.relative(ctx.workspaceRoot, f).split(path.sep).join("/")
    );
    sections.push(`## Related Source Files

${relPaths.map(p => `@${p}`).join("\n")}
`);
  }

  const markdown = sections.join("\n");

  // Ensure .cursor directory exists
  const cursorDir = path.join(ctx.workspaceRoot, ".cursor");
  if (!fs.existsSync(cursorDir)) {
    fs.mkdirSync(cursorDir, { recursive: true });
  }

  // Write the context file
  const contextFilePath = path.join(cursorDir, "test-context.md");
  fs.writeFileSync(contextFilePath, markdown, "utf8");

  return {
    contextFilePath,
    testCommand,
    specRelPath,
    markdown, // Include the content for clipboard
  };
}

/**
 * Tries to infer the source file that a spec is testing.
 * e.g., my-service.spec.ts -> my-service.ts
 */
export function inferSourceFile(specAbsPath: string): string | null {
  const dir = path.dirname(specAbsPath);
  const basename = path.basename(specAbsPath);

  // Common patterns: .spec.ts, .test.ts
  const sourceBasename = basename
    .replace(/\.spec\.ts$/, ".ts")
    .replace(/\.test\.ts$/, ".ts");

  if (sourceBasename === basename) {
    return null; // No transformation happened
  }

  const candidatePath = path.join(dir, sourceBasename);
  if (fs.existsSync(candidatePath)) {
    return candidatePath;
  }

  return null;
}

export interface EnsureRulesResult {
  path: string | null;
  action: "created" | "exists" | "updated" | "failed";
}

/**
 * Ensures the Jest testing rules template exists in the target workspace's .cursor/rules/ folder.
 * By default, only copies if the file doesn't exist (preserves user customizations).
 * 
 * @param workspaceRoot The target Nx workspace root
 * @param forceUpdate If true, overwrites existing file with latest template
 * @returns Result with path and action taken
 */
export function ensureJestTestingRules(
  workspaceRoot: string,
  forceUpdate = false
): EnsureRulesResult {
  try {
    // Find the template file using extensionRoot if set, otherwise try common paths
    let templatePath: string | null = null;
    
    if (extensionRoot) {
      // Extension is activated, use its root
      templatePath = path.join(extensionRoot, "docs", "jest-testing-template.mdc");
      if (!fs.existsSync(templatePath)) {
        templatePath = null;
      }
    }
    
    if (!templatePath) {
      // Template not found - skip silently
      return { path: null, action: "failed" };
    }
    
    const sourcePath = templatePath;

    // Check destination
    const rulesDir = path.join(workspaceRoot, ".cursor", "rules");
    const destPath = path.join(rulesDir, "jest-testing.mdc");
    
    // If file exists and not forcing update, skip
    if (fs.existsSync(destPath) && !forceUpdate) {
      return { path: destPath, action: "exists" };
    }

    // Ensure .cursor/rules directory exists in target workspace
    if (!fs.existsSync(rulesDir)) {
      fs.mkdirSync(rulesDir, { recursive: true });
    }

    // Copy the template
    const templateContent = fs.readFileSync(sourcePath, "utf8");
    
    // Add a header indicating this was auto-generated
    const header = `# Auto-copied by et-test-runner
# Source: ${sourcePath}
# To customize, edit this file directly.
# To update from template, press Ctrl+Shift+U in et-test-runner.

`;
    
    fs.writeFileSync(destPath, header + templateContent, "utf8");
    
    const action = forceUpdate ? "updated" : "created";
    return { path: destPath, action };
  } catch {
    // Silently fail - rules are nice to have but not required
    return { path: null, action: "failed" };
  }
}

