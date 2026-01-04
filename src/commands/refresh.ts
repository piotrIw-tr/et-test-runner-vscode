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

  webviewProvider.addLog('action', 'Refreshing workspace...');

  try {
    const { loadWorkspaceState } = await import('../services/app/loadWorkspaceState.js');
    const { findWorkspaceRoot } = await import('../services/workspace/findWorkspaceRoot.js');
    const { execa } = await import('execa');
    const config = vscode.workspace.getConfiguration('et-test-runner');

    // Find the actual nx workspace root (may be in a subdirectory)
    const workspaceRoot = await findWorkspaceRoot(vsCodeWorkspace);
    outputChannel.appendLine(`Nx workspace root: ${workspaceRoot}`);
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
    webviewProvider.addLog('debug', `Base ref: ${baseRef}`);

    const result = await loadWorkspaceState({
      workspaceRoot,
      baseRef,
      skipFetch: config.get<boolean>('skipGitFetch', false),
      verbose: config.get<boolean>('verbose', false)
    });

    webviewProvider.updateProjects(result.projects, workspaceRoot, branch);
    
    const totalSpecs = result.projects.reduce((s, p) => s + p.specs.length, 0);
    const totalMissing = result.projects.reduce((s, p) => s + (p.missingSpecs?.length || 0), 0);
    
    webviewProvider.addLog('info', `Loaded ${result.projects.length} projects, ${totalSpecs} specs`);
    if (totalMissing > 0) {
      webviewProvider.addLog('warn', `${totalMissing} missing spec files detected`);
    }
    
    // Log project summary
    for (const project of result.projects) {
      if (project.specs.length > 0 || (project.missingSpecs?.length || 0) > 0) {
        webviewProvider.addLog('debug', `  ${project.name}: ${project.specs.length} specs, ${project.missingSpecs?.length || 0} missing`);
      }
    }
  } catch (error) {
    outputChannel.appendLine(`WebView refresh error: ${error}`);
    webviewProvider.addLog('error', `Refresh failed: ${error}`);
  }
}
