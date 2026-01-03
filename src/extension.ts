import * as vscode from 'vscode';
import path from 'node:path';
import { ProjectsTreeProvider } from './views/projectsTreeProvider.js';
import { TestRunnerViewProvider } from './webview/TestRunnerViewProvider.js';
import { refreshCommand, refreshWebviewCommand } from './commands/refresh.js';
import { runSelectedCommand, runProjectCommand, runAllCommand, runSpecsFromWebview } from './commands/runTests.js';
import { aiAssistCommand, aiAssistFromWebview } from './commands/aiAssist.js';
import { createSpecCommand } from './commands/createSpec.js';
import { WorkspaceCache } from './state/workspaceCache.js';
import { UIStateManager } from './state/uiState.js';
import { RunningStateManager } from './state/runningState.js';

let treeProvider: ProjectsTreeProvider;
let webviewProvider: TestRunnerViewProvider;
let workspaceCache: WorkspaceCache;
let uiStateManager: UIStateManager;
let runningStateManager: RunningStateManager;
let outputChannel: vscode.OutputChannel;
let statusBar: vscode.StatusBarItem;

export async function activate(context: vscode.ExtensionContext) {
  outputChannel = vscode.window.createOutputChannel('ET Test Runner');
  outputChannel.appendLine('='.repeat(80));
  outputChannel.appendLine('ET Test Runner - Extension Activated');
  outputChannel.appendLine('='.repeat(80));
  outputChannel.appendLine(`Workspace: ${vscode.workspace.workspaceFolders?.[0]?.uri.fsPath || 'None'}`);
  outputChannel.appendLine(`Time: ${new Date().toLocaleString()}`);
  outputChannel.appendLine('='.repeat(80));
  outputChannel.appendLine('');

  // Create status bar item
  statusBar = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Left, 100);
  statusBar.text = '$(beaker) ET Tests';
  statusBar.tooltip = 'ET Test Runner - Click to refresh';
  statusBar.command = 'et-test-runner.refresh';
  statusBar.show();

  // Initialize state managers
  workspaceCache = new WorkspaceCache(context);
  uiStateManager = new UIStateManager(context);
  runningStateManager = new RunningStateManager();

  // Initialize tree provider (used internally for data loading)
  treeProvider = new ProjectsTreeProvider(workspaceCache, outputChannel, statusBar);

  // Initialize WebView provider (primary UI)
  webviewProvider = new TestRunnerViewProvider(
    context.extensionUri,
    uiStateManager,
    runningStateManager,
    workspaceCache,
    outputChannel
  );

  // Register WebView
  const webviewViewDisposable = vscode.window.registerWebviewViewProvider(
    TestRunnerViewProvider.viewType,
    webviewProvider,
    {
      webviewOptions: {
        retainContextWhenHidden: true
      }
    }
  );

  // Register commands
  context.subscriptions.push(
    // Core commands
    vscode.commands.registerCommand('et-test-runner.refresh', async () => {
      await refreshCommand(treeProvider, outputChannel);
      await refreshWebviewCommand(webviewProvider, outputChannel);
    }),

    vscode.commands.registerCommand('et-test-runner.runSelected', (item) =>
      runSelectedCommand(item, treeProvider, workspaceCache, outputChannel, runningStateManager)
    ),

    vscode.commands.registerCommand('et-test-runner.runProject', (item) =>
      runProjectCommand(item, treeProvider, workspaceCache, outputChannel, runningStateManager)
    ),

    vscode.commands.registerCommand('et-test-runner.runAll', () =>
      runAllCommand(treeProvider, workspaceCache, outputChannel, runningStateManager)
    ),

    vscode.commands.registerCommand('et-test-runner.aiAssist', (item) =>
      aiAssistCommand(item, workspaceCache, outputChannel)
    ),

    vscode.commands.registerCommand('et-test-runner.clearCache', async () => {
      await workspaceCache.clear();
      await refreshCommand(treeProvider, outputChannel);
      await refreshWebviewCommand(webviewProvider, outputChannel);
      vscode.window.showInformationMessage('Test cache cleared');
    }),

    // WebView-specific commands
    vscode.commands.registerCommand('et-test-runner.runSelectedFromWebview', async (specPaths: string[]) => {
      await runSpecsFromWebview(
        specPaths,
        treeProvider,
        workspaceCache,
        outputChannel,
        runningStateManager,
        webviewProvider,
        uiStateManager
      );
    }),

    vscode.commands.registerCommand('et-test-runner.aiAssistFromWebview', async (context: { specPath: string; action: string; projectName: string; projectRootAbs: string; consoleOutput?: string }) => {
      const { aiAssistFromWebview: aiAssistFn } = await import('./commands/aiAssist.js');
      await aiAssistFn(
        {
          specPath: context.specPath,
          action: context.action as 'fix' | 'write' | 'refactor',
          projectName: context.projectName,
          projectRootAbs: context.projectRootAbs,
          consoleOutput: context.consoleOutput,
        },
        workspaceCache,
        outputChannel
      );
    }),

    vscode.commands.registerCommand('et-test-runner.createSpec', async (missingSpecPath: string, sourcePath: string) => {
      await createSpecCommand(missingSpecPath, sourcePath, outputChannel);
      await refreshCommand(treeProvider, outputChannel);
      await refreshWebviewCommand(webviewProvider, outputChannel);
    }),

    vscode.commands.registerCommand('et-test-runner.cancelTest', async () => {
      const cancelled = await runningStateManager.cancel();
      if (cancelled) {
        outputChannel.appendLine('\nTest run cancelled by user');
        webviewProvider.addLog('action', 'Test run cancelled');
      }
    }),

    vscode.commands.registerCommand('et-test-runner.toggleLogs', () => {
      uiStateManager.toggleLogsVisible();
      webviewProvider.refreshView();
    }),

    vscode.commands.registerCommand('et-test-runner.search', () => {
      // Focus the search input in WebView
      webviewProvider.refreshView();
    }),

    vscode.commands.registerCommand('et-test-runner.quickRunCurrentFile', async () => {
      const editor = vscode.window.activeTextEditor;
      if (!editor) {
        vscode.window.showWarningMessage('No file is currently open');
        return;
      }

      const filePath = editor.document.uri.fsPath;
      let specPath = filePath;

      // If not a spec file, try to find the corresponding spec
      if (!filePath.endsWith('.spec.ts')) {
        specPath = filePath.replace(/\.ts$/, '.spec.ts');
        try {
          await vscode.workspace.fs.stat(vscode.Uri.file(specPath));
        } catch {
          vscode.window.showWarningMessage(`No spec file found for ${path.basename(filePath)}`);
          return;
        }
      }

      await runSpecsFromWebview(
        [specPath],
        treeProvider,
        workspaceCache,
        outputChannel,
        runningStateManager,
        webviewProvider,
        uiStateManager
      );
    }),

    // Disposables
    webviewViewDisposable,
    statusBar,
    outputChannel,
    { dispose: () => runningStateManager.dispose() },
    { dispose: () => webviewProvider.dispose() }
  );

  // Set up file watchers if auto-refresh is enabled
  const extensionConfig = vscode.workspace.getConfiguration('et-test-runner');
  if (extensionConfig.get<boolean>('autoRefresh', true)) {
    setupFileWatchers(context, treeProvider, webviewProvider);
  }

  // Initial load - populate both tree provider and webview
  await refreshCommand(treeProvider, outputChannel);
  await refreshWebviewCommand(webviewProvider, outputChannel);

  // Log configuration
  outputChannel.appendLine('Configuration:');
  outputChannel.appendLine(`  Base Ref: ${extensionConfig.get('baseRef')}`);
  outputChannel.appendLine(`  Coverage: ${extensionConfig.get('coverage')}`);
  outputChannel.appendLine(`  Auto Refresh: ${extensionConfig.get('autoRefresh')}`);
  outputChannel.appendLine(`  Skip Git Fetch: ${extensionConfig.get('skipGitFetch')}`);
  outputChannel.appendLine('');
  outputChannel.appendLine('Keyboard Shortcuts:');
  outputChannel.appendLine('  • Cmd+E (Ctrl+E) - Refresh workspace');
  outputChannel.appendLine('  • Cmd+R (Ctrl+R) - Run selected specs');
  outputChannel.appendLine('  • Cmd+X (Ctrl+X) - Cancel running test');
  outputChannel.appendLine('  • Cmd+F (Ctrl+F) - Search specs');
  outputChannel.appendLine('  • Cmd+Shift+R - Quick run current file');
  outputChannel.appendLine('  • ` (backtick) - Toggle logs pane');
  outputChannel.appendLine('  • c - Toggle compact mode');
  outputChannel.appendLine('');

  // Set context for welcome view
  const workspaceRoot = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;
  if (workspaceRoot) {
    try {
      const nxJsonUri = vscode.Uri.file(`${workspaceRoot}/nx.json`);
      await vscode.workspace.fs.stat(nxJsonUri);
      vscode.commands.executeCommand('setContext', 'et-test-runner.hasWorkspace', true);
    } catch {
      vscode.commands.executeCommand('setContext', 'et-test-runner.hasWorkspace', false);
    }
  }

  outputChannel.appendLine('ET Test Runner extension ready (WebView UI enabled)');
  webviewProvider.addLog('info', 'Extension activated');
}

function setupFileWatchers(
  context: vscode.ExtensionContext,
  provider: ProjectsTreeProvider,
  webview: TestRunnerViewProvider
) {
  const specWatcher = vscode.workspace.createFileSystemWatcher('**/*.spec.ts');
  let refreshTimeout: NodeJS.Timeout | undefined;

  const debouncedRefresh = () => {
    if (refreshTimeout) {
      clearTimeout(refreshTimeout);
    }
    refreshTimeout = setTimeout(async () => {
      await refreshCommand(provider, outputChannel);
      await refreshWebviewCommand(webview, outputChannel);
    }, 2000); // Increased debounce to 2 seconds to prevent rapid refreshes
  };

  specWatcher.onDidChange(debouncedRefresh);
  specWatcher.onDidCreate(debouncedRefresh);
  specWatcher.onDidDelete(debouncedRefresh);

  context.subscriptions.push(specWatcher);

  // Git change watcher disabled to prevent refresh loops
  // Uncomment if you want auto-refresh on git state changes
  /*
  try {
    const gitExtension = vscode.extensions.getExtension('vscode.git');
    if (gitExtension) {
      const gitExports = gitExtension.exports;
      if (gitExports) {
        const api = gitExports.getAPI(1);
        if (api.repositories.length > 0) {
          const repo = api.repositories[0];
          repo.state.onDidChange(() => {
            debouncedRefresh();
          });
          outputChannel.appendLine('Git integration enabled - will auto-refresh on changes');
          webview.addLog('info', 'Git integration enabled');
        }
      }
    }
  } catch (error) {
    outputChannel.appendLine(`Git integration not available: ${error}`);
  }
  */
}

export function deactivate() {
  outputChannel?.appendLine('ET Test Runner extension deactivated');
}
