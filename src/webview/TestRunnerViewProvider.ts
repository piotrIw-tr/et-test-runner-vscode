import * as vscode from 'vscode';
import path from 'node:path';
import type { 
  WebViewMessage, 
  ExtensionMessage, 
  ProjectState, 
  SpecState, 
  MissingSpecState,
  LogEntry,
  InitializePayload,
  FailurePreview
} from '../types/webview.js';
import type { ProjectWithSpecs } from '../types/model.js';
import type { UIStateManager } from '../state/uiState.js';
import type { RunningStateManager } from '../state/runningState.js';
import type { WorkspaceCache } from '../state/workspaceCache.js';
import { getWebviewContent } from './getWebviewContent.js';
import { parseCoverageSummary } from '../services/coverage/parseCoverage.js';

// Escape special regex characters in a string
function escapeRegex(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

export class TestRunnerViewProvider implements vscode.WebviewViewProvider {
  public static readonly viewType = 'et-test-runner.mainView';

  private _view?: vscode.WebviewView;
  private _projects: ProjectWithSpecs[] = [];
  private _workspaceRoot?: string;
  private _currentBranch: string = '';
  private _outputBuffer: string[] = [];
  private _disposables: vscode.Disposable[] = [];
  private _webviewReceivedProjects: boolean = false;

  constructor(
    private readonly extensionUri: vscode.Uri,
    private readonly uiState: UIStateManager,
    private readonly runningState: RunningStateManager,
    private readonly cache: WorkspaceCache,
    private readonly outputChannel: vscode.OutputChannel
  ) {
    // Listen to running state changes
    this._disposables.push(
      this.runningState.onStateChange(state => {
        this.postMessage({ type: 'updateRunningState', payload: state });
      })
    );
  }

  public resolveWebviewView(
    webviewView: vscode.WebviewView,
    _context: vscode.WebviewViewResolveContext,
    _token: vscode.CancellationToken
  ): void {
    this._view = webviewView;

    webviewView.webview.options = {
      enableScripts: true,
      localResourceRoots: [this.extensionUri]
    };

    webviewView.webview.html = getWebviewContent(webviewView.webview, this.extensionUri);

    // Handle messages from the WebView
    webviewView.webview.onDidReceiveMessage(
      (message: WebViewMessage) => this.handleMessage(message),
      null,
      this._disposables
    );

    // Re-initialize when view becomes visible
    webviewView.onDidChangeVisibility(() => {
      if (webviewView.visible) {
        this.sendInitialState();
      }
    });
  }

  private async handleMessage(message: WebViewMessage): Promise<void> {
    console.log('[ET Provider] Received message:', message.type);
    switch (message.type) {
      case 'ready':
        console.log('[ET Provider] WebView ready, projects stored:', this._projects.length);
        this._webviewReceivedProjects = false; // Reset flag on new ready signal
        await this.sendInitialState();
        // If we already have projects, send them after a small delay to ensure webview is fully ready
        if (this._projects.length > 0) {
          console.log('[ET Provider] Scheduling project send to newly ready webview');
          setTimeout(async () => {
            console.log('[ET Provider] Sending stored projects to webview');
            await this.sendProjectsToWebview();
          }, 100);
        }
        break;
        
      case 'projectsReceived':
        console.log('[ET Provider] Webview confirmed projects received');
        this._webviewReceivedProjects = true;
        break;

      case 'selectProject':
        this.uiState.setSelectedProject(message.payload.projectName);
        this.sendUpdatedSpecs(message.payload.projectName);
        break;

      case 'toggleSpec':
        this.uiState.toggleSpecSelection(message.payload.specPath);
        this.sendUIStateUpdate();
        break;

      case 'selectAllSpecs':
        const currentProject = this.getCurrentProject();
        if (currentProject) {
          const allPaths = currentProject.specs.map(s => s.absPath);
          this.uiState.selectAllSpecs(allPaths);
          this.sendUIStateUpdate();
        }
        break;

      case 'clearSelection':
        this.uiState.clearSelection();
        this.sendUIStateUpdate();
        break;

      case 'runSpecs':
        await vscode.commands.executeCommand(
          'et-test-runner.runSelectedFromWebview',
          message.payload.specPaths
        );
        break;

      case 'runProject':
        await vscode.commands.executeCommand(
          'et-test-runner.runProjectFromWebview',
          message.payload.projectName
        );
        break;

      case 'runAllChanged':
        await vscode.commands.executeCommand('et-test-runner.runAllChangedFromWebview');
        break;

      case 'runAllProjectSpecs':
        await vscode.commands.executeCommand(
          'et-test-runner.runAllProjectSpecsFromWebview',
          message.payload.projectName
        );
        break;

      case 'rerunFailed':
        const failed = this.runningState.lastFailedSpecs;
        if (failed.length > 0) {
          await vscode.commands.executeCommand(
            'et-test-runner.runSelectedFromWebview',
            failed
          );
        }
        break;

      case 'cancelRun':
        await this.runningState.cancel();
        break;

      case 'refresh':
        this.showLoader('Refreshing workspace...');
        await vscode.commands.executeCommand('et-test-runner.refresh');
        break;

      case 'aiAssist':
        // Find the project for this spec
        const specProject = this._projects.find(p => 
          p.specs.some(s => s.absPath === message.payload.specPath)
        );
        
        await vscode.commands.executeCommand(
          'et-test-runner.aiAssistFromWebview',
          {
            specPath: message.payload.specPath,
            action: message.payload.action,
            projectName: specProject?.name || 'unknown',
            projectRootAbs: specProject?.rootAbs || '',
            consoleOutput: this._outputBuffer.join('\n'),
            target: message.payload.target || 'cursor', // 'cursor' or 'copilot'
          }
        );
        break;

      case 'createSpec':
        this.showLoader('Creating spec file...');
        try {
          await vscode.commands.executeCommand(
            'et-test-runner.createSpec',
            message.payload.missingSpecPath,
            message.payload.sourcePath
          );
          // Manually trigger refresh (the file watcher has 2s debounce which is too slow)
          // Use internal refresh to avoid duplicate loader
          this.showLoader('Refreshing workspace...');
          await vscode.commands.executeCommand('et-test-runner.refreshInternal');
        } finally {
          this.hideLoader();
        }
        break;

      case 'search':
        this.uiState.setSearchQuery(message.payload.query);
        this.sendUIStateUpdate();
        break;

      case 'toggleLogs':
        this.uiState.toggleLogsVisible();
        this.sendUIStateUpdate();
        break;


      case 'pinSpec':
        await this.uiState.pinSpec(message.payload.specPath);
        this.sendUIStateUpdate();
        break;

      case 'unpinSpec':
        await this.uiState.unpinSpec(message.payload.specPath);
        this.sendUIStateUpdate();
        break;

      case 'openFile':
        try {
          const filePath = message.payload.filePath;
          if (!filePath || typeof filePath !== 'string' || filePath.trim() === '') {
            console.error('[ET Provider] openFile: Invalid file path:', filePath);
            break;
          }
          
          // Check if file exists first
          const fs = await import('fs');
          if (!fs.existsSync(filePath)) {
            console.warn('[ET Provider] openFile: File does not exist:', filePath);
            vscode.window.showWarningMessage(`File not found: ${filePath.split('/').pop()}`);
            break;
          }
          
          const uri = vscode.Uri.file(filePath);
          const options: vscode.TextDocumentShowOptions = {};
          
          if (message.payload.line !== undefined) {
            const pos = new vscode.Position(
              message.payload.line - 1,
              (message.payload.column || 1) - 1
            );
            options.selection = new vscode.Range(pos, pos);
          }
          
          const doc = await vscode.window.showTextDocument(uri, options);
          
          // If searchText is provided, try to find and navigate to it
          if (message.payload.searchText && !message.payload.line) {
            const searchText = message.payload.searchText;
            const text = doc.document.getText();
            
            // Try to find the test name in the document
            // Look for patterns like: it('test name', describe('test name', test('test name'
            const patterns = [
              new RegExp(`(it|test|describe)\\s*\\(\\s*['"\`]${escapeRegex(searchText)}['"\`]`, 'i'),
              new RegExp(escapeRegex(searchText), 'i')
            ];
            
            for (const pattern of patterns) {
              const match = text.match(pattern);
              if (match && match.index !== undefined) {
                const pos = doc.document.positionAt(match.index);
                const range = new vscode.Range(pos, pos);
                doc.revealRange(range, vscode.TextEditorRevealType.InCenter);
                doc.selection = new vscode.Selection(pos, pos);
                break;
              }
            }
          }
        } catch (err) {
          console.error('[ET Provider] openFile error:', err);
        }
        break;

      case 'copyToClipboard':
        await vscode.env.clipboard.writeText(message.payload.text);
        vscode.window.showInformationMessage('Copied to clipboard');
        break;
    }
  }

  private getCurrentProject(): ProjectWithSpecs | undefined {
    const selectedName = this.uiState.getUIState().selectedProjectName;
    if (!selectedName) return undefined;
    return this._projects.find(p => p.name === selectedName);
  }

  private async sendInitialState(): Promise<void> {
    if (!this._view) {
      console.log('[ET Provider] sendInitialState: No view available');
      return;
    }

    const config = vscode.workspace.getConfiguration('et-test-runner');
    const workspaceFolders = vscode.workspace.workspaceFolders;
    const workspacePath = this._workspaceRoot || workspaceFolders?.[0]?.uri.fsPath || '';

    // Use async version to include coverage metrics
    const mappedProjects = await this.mapProjectsToStateAsync();
    console.log('[ET Provider] sendInitialState: Sending', mappedProjects.length, 'projects');

    const uiState = this.uiState.getUIState();
    const payload: InitializePayload = {
      projects: mappedProjects,
      // Convert Sets to Arrays for JSON serialization
      uiState: {
        ...uiState,
        selectedSpecPaths: Array.from(uiState.selectedSpecPaths),
        pinnedSpecPaths: Array.from(uiState.pinnedSpecPaths)
      } as any,
      runningState: this.runningState.getState(),
      logs: this.uiState.getLogs(),
      config: {
        baseRef: config.get('baseRef', 'origin/main'),
        branch: this._currentBranch,
        workspacePath
      }
    };

    this.postMessage({ type: 'initialize', payload });
  }

  private sendUpdatedSpecs(projectName: string): void {
    const project = this._projects.find(p => p.name === projectName);
    if (!project) return;

    const specs = this.mapSpecsToState(project);
    const missingSpecs = this.mapMissingSpecsToState(project);

    this.postMessage({
      type: 'updateSpecs',
      payload: { specs, missingSpecs }
    });
  }

  private sendUIStateUpdate(): void {
    const uiState = this.uiState.getUIState();
    // Convert Sets to Arrays for JSON serialization (WebView needs arrays, not Sets)
    this.postMessage({
      type: 'updateUIState',
      payload: {
        ...uiState,
        selectedSpecPaths: Array.from(uiState.selectedSpecPaths),
        pinnedSpecPaths: Array.from(uiState.pinnedSpecPaths)
      } as any
    });
  }

  private mapProjectsToState(): ProjectState[] {
    return this._projects.map(project => {
      const metrics = this.calculateProjectMetrics(project);
      return {
        name: project.name,
        runner: project.runner,
        rootAbs: project.rootAbs,
        specs: this.mapSpecsToState(project),
        missingSpecs: this.mapMissingSpecsToState(project),
        metrics
      };
    });
  }

  private async mapProjectsToStateAsync(): Promise<ProjectState[]> {
    const projectStates: ProjectState[] = [];
    
    for (const project of this._projects) {
      const metrics = await this.calculateProjectMetricsAsync(project);
      projectStates.push({
        name: project.name,
        runner: project.runner,
        rootAbs: project.rootAbs,
        specs: this.mapSpecsToState(project),
        missingSpecs: this.mapMissingSpecsToState(project),
        metrics
      });
    }
    
    return projectStates;
  }

  private async calculateProjectMetricsAsync(project: ProjectWithSpecs): Promise<ProjectState['metrics'] | undefined> {
    const baseMetrics = this.calculateProjectMetrics(project);
    if (!baseMetrics || !this._workspaceRoot) return baseMetrics;

    // Try to get coverage data
    try {
      const projectRootRel = path.relative(this._workspaceRoot, project.rootAbs);
      const coverageSummary = await parseCoverageSummary(this._workspaceRoot, projectRootRel);
      
      if (coverageSummary) {
        return {
          ...baseMetrics,
          coveragePercent: coverageSummary.total.statements.pct,
          coverage: {
            statements: coverageSummary.total.statements.pct,
            functions: coverageSummary.total.functions.pct,
            branches: coverageSummary.total.branches.pct,
            lines: coverageSummary.total.lines.pct
          }
        };
      }
      return baseMetrics;
    } catch {
      return baseMetrics;
    }
  }

  private mapSpecsToState(project: ProjectWithSpecs): SpecState[] {
    const uiState = this.uiState.getUIState();
    const runningState = this.runningState.getState();

    return project.specs.map(spec => {
      const relPath = this._workspaceRoot 
        ? path.relative(this._workspaceRoot, spec.absPath)
        : spec.absPath;
      // Path relative to project/lib root (for display)
      const libRelPath = path.relative(project.rootAbs, spec.absPath);
      const fileName = path.basename(spec.absPath);
      const cachedMetrics = this.cache.get(relPath);

      let testStatus: SpecState['testStatus'] = 'pending';
      if (runningState.isRunning && runningState.specPaths?.includes(spec.absPath)) {
        if (runningState.progress?.currentSpec === spec.absPath) {
          testStatus = 'running';
        } else if (runningState.progress && 
                   runningState.specPaths.indexOf(spec.absPath) < runningState.progress.completed) {
          testStatus = cachedMetrics?.exitCode === 0 ? 'pass' : 'fail';
        } else {
          testStatus = 'queued';
        }
      } else if (cachedMetrics) {
        testStatus = cachedMetrics.exitCode === 0 ? 'pass' : 'fail';
      }

      return {
        absPath: spec.absPath,
        relPath,
        libRelPath,
        fileName,
        status: spec.status,
        testStatus,
        selected: uiState.selectedSpecPaths.has(spec.absPath),
        pinned: uiState.pinnedSpecPaths.has(spec.absPath),
        metrics: cachedMetrics ? {
          passed: cachedMetrics.jest?.passed || 0,
          failed: cachedMetrics.jest?.failed || 0,
          skipped: cachedMetrics.jest?.skipped || 0,
          total: cachedMetrics.jest?.total || 0,
          durationMs: cachedMetrics.durationMs,
          lastRunIso: cachedMetrics.lastRunIso
        } : undefined
      };
    });
  }

  private mapMissingSpecsToState(project: ProjectWithSpecs): MissingSpecState[] {
    return project.missingSpecs.map(missing => ({
      expectedSpecPath: missing.expectedSpecAbsPath,
      sourcePath: missing.sourceAbsPath,
      sourceStatus: missing.sourceStatus
    }));
  }

  private calculateProjectMetrics(project: ProjectWithSpecs): ProjectState['metrics'] | undefined {
    let passed = 0, failed = 0, skipped = 0, total = 0, durationMs = 0;
    let hasMetrics = false;

    for (const spec of project.specs) {
      const relPath = this._workspaceRoot 
        ? path.relative(this._workspaceRoot, spec.absPath)
        : spec.absPath;
      const metrics = this.cache.get(relPath);
      
      if (metrics?.jest) {
        hasMetrics = true;
        passed += metrics.jest.passed || 0;
        failed += metrics.jest.failed || 0;
        skipped += metrics.jest.skipped || 0;
        total += metrics.jest.total || 0;
        durationMs += metrics.durationMs || 0;
      }
    }

    return hasMetrics ? { passed, failed, skipped, total, durationMs } : undefined;
  }

  // ========== Public API for Extension ==========

  public async updateProjects(projects: ProjectWithSpecs[], workspaceRoot: string, branch?: string): Promise<void> {
    console.log('[ET Provider] updateProjects called with', projects.length, 'projects, view exists:', !!this._view);
    this._projects = projects;
    this._workspaceRoot = workspaceRoot;
    if (branch) {
      this._currentBranch = branch;
    }
    
    // If view exists, send update; otherwise data will be sent via sendInitialState when view becomes ready
    if (this._view) {
      await this.sendProjectsToWebview();
    }
  }
  
  private async sendProjectsToWebview(retryCount = 0): Promise<void> {
    if (!this._view || this._projects.length === 0) return;
    
    // If webview already confirmed receipt, don't send again
    if (this._webviewReceivedProjects && retryCount > 0) {
      console.log('[ET Provider] Webview already received projects, skipping retry');
      return;
    }
    
    // Use async version to include coverage metrics
    const mappedProjects = await this.mapProjectsToStateAsync();
    console.log('[ET Provider] Sending updateProjects message with', mappedProjects.length, 'projects (attempt', retryCount + 1, ')');
    
    this.postMessage({
      type: 'updateProjects',
      payload: { 
        projects: mappedProjects,
        branch: this._currentBranch,
        workspacePath: this._workspaceRoot
      }
    });
    
    // Retry a few times to ensure delivery (webview might not be fully ready)
    if (retryCount < 3 && !this._webviewReceivedProjects) {
      setTimeout(() => {
        if (this._view && this._projects.length > 0 && !this._webviewReceivedProjects) {
          console.log('[ET Provider] Retry sending updateProjects...');
          this.sendProjectsToWebview(retryCount + 1);
        }
      }, 500 * (retryCount + 1));
    }
  }

  public appendOutput(content: string): void {
    this._outputBuffer.push(content);
    // Keep buffer manageable
    if (this._outputBuffer.length > 1000) {
      this._outputBuffer = this._outputBuffer.slice(-500);
    }
    
    this.postMessage({
      type: 'updateOutput',
      payload: { content, append: true }
    });
  }

  public clearOutput(): void {
    this._outputBuffer = [];
    this.postMessage({
      type: 'updateOutput',
      payload: { content: '', append: false }
    });
  }

  public addLog(level: LogEntry['level'], message: string): void {
    const entry = this.uiState.addLog(level, message);
    this.postMessage({ type: 'addLog', payload: entry });
  }

  public async refreshView(): Promise<void> {
    await this.sendInitialState();
  }

  public showLoader(text?: string): void {
    this.postMessage({ type: 'showLoader', payload: { text } });
  }

  public hideLoader(): void {
    this.postMessage({ type: 'hideLoader' });
  }

  public showNotNxWorkspace(workspacePath: string): void {
    this.postMessage({ type: 'notNxWorkspace', payload: { workspacePath } });
  }

  private postMessage(message: ExtensionMessage): boolean {
    if (!this._view) {
      console.log('[ET Provider] postMessage: No view available for', message.type);
      return false;
    }
    // Note: postMessage returns Thenable<boolean> indicating if message was delivered
    this._view.webview.postMessage(message).then(
      success => {
        if (!success) {
          console.log('[ET Provider] postMessage FAILED for', message.type);
        }
      },
      err => {
        console.log('[ET Provider] postMessage ERROR for', message.type, err);
      }
    );
    return true;
  }

  public dispose(): void {
    for (const d of this._disposables) {
      d.dispose();
    }
  }
}

