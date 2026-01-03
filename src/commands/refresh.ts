import * as vscode from 'vscode';
import type { ProjectsTreeProvider } from '../views/projectsTreeProvider.js';
import type { TestRunnerViewProvider } from '../webview/TestRunnerViewProvider.js';

export async function refreshCommand(
  treeProvider: ProjectsTreeProvider,
  outputChannel: vscode.OutputChannel
): Promise<void> {
  outputChannel.appendLine('Refreshing test view...');
  
  await vscode.window.withProgress(
    {
      location: vscode.ProgressLocation.Notification,
      title: 'Refreshing test view',
      cancellable: false
    },
    async () => {
      await treeProvider.loadData();
      treeProvider.refresh();
    }
  );
  
  outputChannel.appendLine('Refresh complete');
}

export async function refreshWebviewCommand(
  webviewProvider: TestRunnerViewProvider,
  outputChannel: vscode.OutputChannel
): Promise<void> {
  const vsCodeWorkspace = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;
  if (!vsCodeWorkspace) return;

  try {
    const { loadWorkspaceState } = await import('../services/app/loadWorkspaceState.js');
    const { findWorkspaceRoot } = await import('../services/workspace/findWorkspaceRoot.js');
    const { execa } = await import('execa');
    const config = vscode.workspace.getConfiguration('et-test-runner');

    // Find the actual nx workspace root (may be in a subdirectory)
    const workspaceRoot = await findWorkspaceRoot(vsCodeWorkspace);
    outputChannel.appendLine(`Nx workspace root: ${workspaceRoot}`);

    // Get current git branch
    let branch = '';
    try {
      const { stdout } = await execa('git', ['rev-parse', '--abbrev-ref', 'HEAD'], { cwd: workspaceRoot });
      branch = stdout.trim();
    } catch {
      // Ignore git errors
    }

    const result = await loadWorkspaceState({
      workspaceRoot,
      baseRef: config.get<string>('baseRef', 'origin/master'),
      skipFetch: config.get<boolean>('skipGitFetch', false),
      verbose: config.get<boolean>('verbose', false)
    });

    webviewProvider.updateProjects(result.projects, workspaceRoot, branch);
    webviewProvider.addLog('info', `Loaded ${result.projects.length} projects with ${result.projects.reduce((s, p) => s + p.specs.length, 0)} specs`);
  } catch (error) {
    outputChannel.appendLine(`WebView refresh error: ${error}`);
    webviewProvider.addLog('error', `Refresh failed: ${error}`);
  }
}
