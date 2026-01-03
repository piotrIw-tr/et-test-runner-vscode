import { exec } from "node:child_process";
import { promisify } from "node:util";

const execAsync = promisify(exec);

export interface OpenCursorOptions {
  /** Absolute path to the file to open */
  filePath: string;
  /** Optional line number to jump to */
  lineNumber?: number;
}

export interface OpenCursorResult {
  success: boolean;
  error?: string;
}

/**
 * Opens a file in Cursor IDE using the cursor:// URL scheme.
 * This works on macOS when Cursor is installed.
 */
export async function openInCursor(
  opts: OpenCursorOptions
): Promise<OpenCursorResult> {
  try {
    // Build the cursor:// URL
    // Format: cursor://file/path/to/file:lineNumber
    let cursorUrl = `cursor://file${opts.filePath}`;
    if (opts.lineNumber && opts.lineNumber > 0) {
      cursorUrl += `:${opts.lineNumber}`;
    }

    // Use 'open' command on macOS to trigger the URL scheme
    await execAsync(`open "${cursorUrl}"`);

    return { success: true };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return { success: false, error: message };
  }
}

/**
 * Copies text to the system clipboard using pbcopy (macOS).
 * Falls back silently if not on macOS.
 */
export async function copyToClipboard(text: string): Promise<boolean> {
  try {
    // Use pbcopy on macOS
    const child = exec("pbcopy");
    child.stdin?.write(text);
    child.stdin?.end();

    return new Promise((resolve) => {
      child.on("close", (code) => {
        resolve(code === 0);
      });
      child.on("error", () => {
        resolve(false);
      });
    });
  } catch {
    return false;
  }
}

/**
 * Opens Cursor with context file and optionally copies a hint to clipboard.
 */
export async function openCursorWithContext(
  contextFilePath: string,
  hint?: string
): Promise<OpenCursorResult> {
  // Copy hint to clipboard if provided
  if (hint) {
    await copyToClipboard(hint);
  }

  // Open the context file in Cursor
  return openInCursor({ filePath: contextFilePath });
}

