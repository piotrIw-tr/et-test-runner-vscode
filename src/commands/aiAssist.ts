import * as vscode from 'vscode';
import path from 'node:path';
import { generateTestContext, inferSourceFile } from '../services/ai/generateTestContext.js';
import { getSpecFailureDetails } from '../services/test/parseJestResults.js';
import { extractSpecFailureOutput } from '../services/test/parseOutputForSpec.js';
import type { WorkspaceCache } from '../state/workspaceCache.js';
import { SpecTreeItem } from '../views/treeItems.js';

type AiAction = 'fix' | 'write' | 'refactor';

// Strip ANSI codes from output
function stripAnsi(text: string): string {
  // eslint-disable-next-line no-control-regex
  return text.replace(/\x1B\[[0-9;]*[a-zA-Z]/g, '');
}

export async function aiAssistCommand(
  item: SpecTreeItem,
  cache: WorkspaceCache,
  outputChannel: vscode.OutputChannel
): Promise<void> {
  const workspaceRoot = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;
  if (!workspaceRoot) {
    vscode.window.showErrorMessage('No workspace root found');
    return;
  }

  const relPath = path.relative(workspaceRoot, item.spec.absPath);
  const metrics = cache.get(relPath);

  // Determine action
  const action = await vscode.window.showQuickPick(
    [
      { label: '$(wrench) Fix Failing Tests', value: 'fix' as const, description: 'Get AI help to fix test failures' },
      { label: '$(edit) Write New Tests', value: 'write' as const, description: 'Add more test coverage' },
      { label: '$(symbol-method) Refactor Tests', value: 'refactor' as const, description: 'Improve test structure' }
    ],
    { 
      placeHolder: 'What would you like to do?',
      title: 'AI Test Assistant'
    }
  );

  if (!action) return;

  await performAiAssist(
    item.spec.absPath,
    item.projectName,
    workspaceRoot,
    action.value,
    cache,
    outputChannel
  );
}

export interface AiAssistContext {
  specPath: string;
  action: AiAction;
  projectName: string;
  projectRootAbs: string;
  consoleOutput?: string;
}

export async function aiAssistFromWebview(
  context: AiAssistContext,
  cache: WorkspaceCache,
  outputChannel: vscode.OutputChannel
): Promise<void> {
  const workspaceRoot = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;
  if (!workspaceRoot) {
    vscode.window.showErrorMessage('No workspace root found');
    return;
  }

  await performAiAssistEnhanced(
    context.specPath,
    context.projectName,
    context.projectRootAbs,
    workspaceRoot,
    context.action,
    context.consoleOutput,
    cache,
    outputChannel
  );
}

async function performAiAssist(
  specPath: string,
  projectName: string,
  workspaceRoot: string,
  action: AiAction,
  cache: WorkspaceCache,
  outputChannel: vscode.OutputChannel
): Promise<void> {
  // Legacy function - just call the enhanced one with no console output
  await performAiAssistEnhanced(specPath, projectName, '', workspaceRoot, action, undefined, cache, outputChannel);
}

async function performAiAssistEnhanced(
  specPath: string,
  projectName: string,
  projectRootAbs: string,
  workspaceRoot: string,
  action: AiAction,
  consoleOutput: string | undefined,
  cache: WorkspaceCache,
  outputChannel: vscode.OutputChannel
): Promise<void> {
  const relPath = path.relative(workspaceRoot, specPath);
  const metrics = cache.get(relPath);

  try {
    // Get failure details from json-result.json (like console app)
    let errorMessage: string | undefined;
    let failingTestNames: string[] | undefined;
    
    if (action === 'fix') {
      // Try to get detailed failure info from json-result.json
      const projectRootRel = projectRootAbs 
        ? path.relative(workspaceRoot, projectRootAbs) 
        : '';
      
      if (projectRootRel) {
        const failureDetails = getSpecFailureDetails(
          workspaceRoot,
          projectRootRel,
          specPath
        );
        
        if (failureDetails) {
          failingTestNames = failureDetails.failingTests.map(t => t.testName);
          const firstFailure = failureDetails.failingTests[0];
          errorMessage = firstFailure?.failureMessage || 
            `${failureDetails.totalFailed} test(s) failing`;
        } else if (metrics?.jest?.failed) {
          errorMessage = `Test has ${metrics.jest.failed} failing test(s)`;
        }
      }
    }

    // Try to find related source file
    const sourceFile = inferSourceFile(specPath);
    const relatedSourceFiles = sourceFile ? [sourceFile] : [];

    // Extract relevant console output for this specific spec
    let finalConsoleOutput: string | undefined;
    if (consoleOutput && action === 'fix') {
      const rawOutput = stripAnsi(consoleOutput);
      const specRelPath = path.relative(workspaceRoot, specPath).split(path.sep).join('/');
      const relevantOutput = extractSpecFailureOutput(rawOutput, specRelPath);
      
      // Use extracted output or fall back to full output (truncated if too large)
      if (relevantOutput) {
        finalConsoleOutput = relevantOutput;
      } else if (rawOutput.length < 50000) {
        finalConsoleOutput = rawOutput;
      } else {
        // Output too large, omit or summarize
        finalConsoleOutput = '(Console output too large - see json-result.json for details)';
      }
    }

    // Generate AI context
    const context = await generateTestContext({
      specAbsPath: specPath,
      projectName,
      workspaceRoot,
      action,
      errorMessage,
      failingTestNames,
      relatedSourceFiles,
      consoleOutput: finalConsoleOutput,
    });

    // Copy context to clipboard
    await vscode.env.clipboard.writeText(context.markdown);

    // Try to focus the appropriate chat panel
    const focusedChat = await focusChatPanel();

    // Show notification
    if (focusedChat) {
      vscode.window.showInformationMessage(
        'AI context copied to clipboard. Press Cmd+V (Ctrl+V) to paste into chat.',
        'Dismiss'
      );
    } else {
      // Fallback: show in webview
      const result = await vscode.window.showInformationMessage(
        'AI context copied to clipboard.',
        'Open Spec File',
        'Dismiss'
      );
      
      if (result === 'Open Spec File') {
        const doc = await vscode.workspace.openTextDocument(specPath);
        await vscode.window.showTextDocument(doc);
      }
    }

    outputChannel.appendLine(`AI context generated for ${path.basename(specPath)} (${action})`);

  } catch (error) {
    outputChannel.appendLine(`Error generating AI context: ${error}`);
    vscode.window.showErrorMessage(`Failed to generate AI context: ${error}`);
  }
}

/**
 * Attempts to focus the AI chat panel in Cursor or VS Code.
 * Returns true if a chat panel was successfully focused.
 */
async function focusChatPanel(): Promise<boolean> {
  // Try Cursor's chat command first
  try {
    await vscode.commands.executeCommand('workbench.action.chat.open');
    return true;
  } catch {
    // Not Cursor or command not available
  }

  // Try VS Code's Copilot Chat
  try {
    await vscode.commands.executeCommand('workbench.panel.chat.view.copilot.focus');
    return true;
  } catch {
    // Copilot not installed or not available
  }

  // Try generic chat focus
  try {
    await vscode.commands.executeCommand('workbench.action.focusPanel');
    return true;
  } catch {
    // Failed to focus any panel
  }

  return false;
}

function showContextInWebview(markdown: string, specPath: string): void {
  const panel = vscode.window.createWebviewPanel(
    'etTestRunnerAiContext',
    'AI Test Context',
    vscode.ViewColumn.Beside,
    { enableScripts: true }
  );

  panel.webview.html = getWebviewContent(markdown, specPath);
  
  panel.webview.onDidReceiveMessage(async message => {
    if (message.command === 'copy') {
      await vscode.env.clipboard.writeText(markdown);
      vscode.window.showInformationMessage('Context copied to clipboard!');
    }
  });
}

function getWebviewContent(markdown: string, specPath: string): string {
  const escapedMarkdown = markdown
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');

  return `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>AI Test Context</title>
    <style>
        body {
            font-family: var(--vscode-font-family);
            padding: 20px;
            color: var(--vscode-foreground);
            background-color: var(--vscode-editor-background);
        }
        .header {
            display: flex;
            justify-content: space-between;
            align-items: center;
            margin-bottom: 20px;
            padding-bottom: 10px;
            border-bottom: 1px solid var(--vscode-panel-border);
        }
        h1 {
            margin: 0;
            font-size: 18px;
        }
        button {
            background-color: var(--vscode-button-background);
            color: var(--vscode-button-foreground);
            border: none;
            padding: 8px 16px;
            cursor: pointer;
            border-radius: 2px;
        }
        button:hover {
            background-color: var(--vscode-button-hoverBackground);
        }
        .content {
            background-color: var(--vscode-textCodeBlock-background);
            padding: 15px;
            border-radius: 4px;
            white-space: pre-wrap;
            font-family: var(--vscode-editor-font-family);
            font-size: var(--vscode-editor-font-size);
            overflow-x: auto;
        }
        .file-path {
            color: var(--vscode-descriptionForeground);
            font-size: 12px;
            margin-bottom: 15px;
        }
        .tip {
            margin-top: 15px;
            padding: 10px;
            background: var(--vscode-inputValidation-infoBackground);
            border: 1px solid var(--vscode-inputValidation-infoBorder);
            border-radius: 4px;
            font-size: 12px;
        }
    </style>
</head>
<body>
    <div class="header">
        <div>
            <h1>AI Test Context</h1>
            <div class="file-path">${specPath}</div>
        </div>
        <button onclick="copyToClipboard()">Copy to Clipboard</button>
    </div>
    <div class="tip">
        💡 <strong>Tip:</strong> Open Cursor/Copilot Chat and paste (Cmd+V) to get AI assistance.
    </div>
    <div class="content">${escapedMarkdown}</div>
    <script>
        const vscode = acquireVsCodeApi();
        function copyToClipboard() {
            vscode.postMessage({ command: 'copy' });
        }
    </script>
</body>
</html>`;
}
