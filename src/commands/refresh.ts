import * as vscode from 'vscode';
import type { ProjectsTreeProvider } from '../views/projectsTreeProvider.js';
import type { TestRunnerViewProvider } from '../webview/TestRunnerViewProvider.js';

/**
 * Combined refresh that loads workspace state once and updates both tree provider and webview.
 * This is much faster than calling them separately (which would load state twice).
 */
export async function refreshAll(
  treeProvider: ProjectsTreeProvider,
  webviewProvider: TestRunnerViewProvider,
  outputChannel: vscode.OutputChannel
): Promise<void> {
  const vsCodeWorkspace = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;
  if (!vsCodeWorkspace) return;

  const startTime = Date.now();
  outputChannel.appendLine('Refreshing workspace (combined)...');
  webviewProvider.addLog('action', 'Refreshing workspace...');

  try {
    outputChannel.appendLine(`[${Date.now() - startTime}ms] Starting dynamic imports...`);
    
    const importStart = Date.now();
    const { loadWorkspaceState } = await import('../services/app/loadWorkspaceState.js');
    outputChannel.appendLine(`[${Date.now() - startTime}ms] Imported loadWorkspaceState (+${Date.now() - importStart}ms)`);
    
    const { findWorkspaceRoot } = await import('../services/workspace/findWorkspaceRoot.js');
    outputChannel.appendLine(`[${Date.now() - startTime}ms] Imported findWorkspaceRoot`);
    
    const { execa } = await import('execa');
    outputChannel.appendLine(`[${Date.now() - startTime}ms] Imported execa`);
    
    const config = vscode.workspace.getConfiguration('et-test-runner');

    // Find the actual nx workspace root (may be in a subdirectory)
    outputChannel.appendLine(`[${Date.now() - startTime}ms] Finding workspace root...`);
    const findRootStart = Date.now();
    const workspaceRoot = await findWorkspaceRoot(vsCodeWorkspace);
    outputChannel.appendLine(`[${Date.now() - startTime}ms] Found workspace root: ${workspaceRoot} (+${Date.now() - findRootStart}ms)`);
    webviewProvider.addLog('debug', `Workspace root: ${workspaceRoot}`);

    // Get current git branch
    let branch = '';
    try {
      const { stdout } = await execa('git', ['rev-parse', '--abbrev-ref', 'HEAD'], { cwd: workspaceRoot });
      branch = stdout.trim();
      webviewProvider.addLog('debug', `Git branch: ${branch}`);
    } catch {
      webviewProvider.addLog('warn', 'Could not detect git branch');
    }

    const baseRef = config.get<string>('baseRef', 'origin/master');
    const skipFetch = config.get<boolean>('skipGitFetch', false);
    const verbose = config.get<boolean>('verbose', false);
    
    outputChannel.appendLine(`Base ref: ${baseRef}, skipFetch: ${skipFetch}`);
    webviewProvider.addLog('debug', `Base ref: ${baseRef}`);

    // Load workspace state ONCE - pass outputChannel for timing logs
    outputChannel.appendLine('Loading workspace state...');
    const loadStart = Date.now();
    const result = await loadWorkspaceState({
      workspaceRoot,
      baseRef,
      skipFetch,
      verbose,
      log: (msg) => outputChannel.appendLine(msg)
    });
    outputChannel.appendLine(`Workspace state loaded in ${Date.now() - loadStart}ms`);

    // Update tree provider with the same data
    treeProvider.setProjects(result.projects, workspaceRoot);
    treeProvider.refresh();

    // Update webview
    webviewProvider.updateProjects(result.projects, workspaceRoot, branch);
    
    const totalSpecs = result.projects.reduce((s, p) => s + p.specs.length, 0);
    const totalMissing = result.projects.reduce((s, p) => s + (p.missingSpecs?.length || 0), 0);
    
    outputChannel.appendLine(`Loaded ${result.projects.length} projects, ${totalSpecs} specs in ${Date.now() - startTime}ms`);
    webviewProvider.addLog('info', `Loaded ${result.projects.length} projects, ${totalSpecs} specs`);
    if (totalMissing > 0) {
      webviewProvider.addLog('warn', `${totalMissing} missing spec files detected`);
    }
    
    // Log project summary (verbose mode)
    if (verbose) {
      for (const project of result.projects) {
        if (project.specs.length > 0 || (project.missingSpecs?.length || 0) > 0) {
          webviewProvider.addLog('debug', `  ${project.name}: ${project.specs.length} specs, ${project.missingSpecs?.length || 0} missing`);
        }
      }
    }
  } catch (error) {
    outputChannel.appendLine(`Refresh error: ${error}`);
    webviewProvider.addLog('error', `Refresh failed: ${error}`);
  }
}

// Legacy functions for backwards compatibility - redirect to combined refresh
export async function refreshCommand(
  treeProvider: ProjectsTreeProvider,
  outputChannel: vscode.OutputChannel
): Promise<void> {
  // This is now a no-op - use refreshAll instead
  outputChannel.appendLine('Note: refreshCommand is deprecated, use refreshAll');
}

export async function refreshWebviewCommand(
  webviewProvider: TestRunnerViewProvider,
  outputChannel: vscode.OutputChannel
): Promise<void> {
  // This is now a no-op - use refreshAll instead
  outputChannel.appendLine('Note: refreshWebviewCommand is deprecated, use refreshAll');
}
