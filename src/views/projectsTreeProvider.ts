import * as vscode from 'vscode';
import path from 'node:path';
import { loadWorkspaceState } from '../services/app/loadWorkspaceState.js';
import { findWorkspaceRoot } from '../services/workspace/findWorkspaceRoot.js';
import type { ProjectWithSpecs } from '../types/model.js';
import { WorkspaceCache } from '../state/workspaceCache.js';
import { ProjectTreeItem, SpecTreeItem } from './treeItems.js';

export class ProjectsTreeProvider implements vscode.TreeDataProvider<vscode.TreeItem> {
  private _onDidChangeTreeData = new vscode.EventEmitter<vscode.TreeItem | undefined | null | void>();
  readonly onDidChangeTreeData = this._onDidChangeTreeData.event;

  private projects: ProjectWithSpecs[] = [];
  private workspaceRoot?: string;

  constructor(
    private cache: WorkspaceCache,
    private outputChannel: vscode.OutputChannel,
    private statusBar: vscode.StatusBarItem
  ) {}

  refresh(): void {
    this._onDidChangeTreeData.fire();
  }

  async loadData(): Promise<void> {
    const workspaceFolders = vscode.workspace.workspaceFolders;
    if (!workspaceFolders || workspaceFolders.length === 0) {
      this.projects = [];
      this.updateStatusBar(0, 0);
      return;
    }

    const vsCodeWorkspace = workspaceFolders[0].uri.fsPath;
    const config = vscode.workspace.getConfiguration('et-test-runner');

    try {
      // Find the actual nx workspace root (may be in a subdirectory)
      this.workspaceRoot = await findWorkspaceRoot(vsCodeWorkspace);
      this.outputChannel.appendLine(`Nx workspace root: ${this.workspaceRoot}`);
      
      const result = await loadWorkspaceState({
        workspaceRoot: this.workspaceRoot,
        baseRef: config.get<string>('baseRef', 'origin/master'),
        skipFetch: config.get<boolean>('skipGitFetch', false),
        verbose: config.get<boolean>('verbose', false)
      });

      this.projects = result.projects;
      
      // Update status bar
      const totalSpecs = this.projects.reduce((sum, p) => sum + p.specs.length, 0);
      const failedSpecs = this.countFailedSpecs();
      this.updateStatusBar(totalSpecs, failedSpecs);

      this.outputChannel.appendLine(`Loaded ${this.projects.length} projects with ${totalSpecs} specs`);
    } catch (error) {
      this.outputChannel.appendLine(`Error loading workspace: ${error}`);
      vscode.window.showErrorMessage(`Failed to load workspace: ${error}`);
      this.projects = [];
      this.updateStatusBar(0, 0);
    }
  }

  private countFailedSpecs(): number {
    if (!this.workspaceRoot) return 0;
    
    let failed = 0;
    for (const project of this.projects) {
      for (const spec of project.specs) {
        const relPath = path.relative(this.workspaceRoot, spec.absPath);
        const metrics = this.cache.get(relPath);
        if (metrics && metrics.exitCode !== 0) {
          failed++;
        }
      }
    }
    return failed;
  }

  private updateStatusBar(total: number, failed: number): void {
    if (failed > 0) {
      this.statusBar.text = `$(beaker) ${total} tests ($(error) ${failed} failed)`;
      this.statusBar.backgroundColor = new vscode.ThemeColor('statusBarItem.errorBackground');
    } else if (total > 0) {
      this.statusBar.text = `$(beaker) ${total} tests $(check)`;
      this.statusBar.backgroundColor = undefined;
    } else {
      this.statusBar.text = '$(beaker) No tests';
      this.statusBar.backgroundColor = undefined;
    }
  }

  getTreeItem(element: vscode.TreeItem): vscode.TreeItem {
    return element;
  }

  async getChildren(element?: vscode.TreeItem): Promise<vscode.TreeItem[]> {
    if (!element) {
      // Root level: show projects
      if (!this.workspaceRoot) return [];
      return this.projects.map(project => 
        new ProjectTreeItem(project, this.workspaceRoot!, this.cache)
      );
    }

    if (element instanceof ProjectTreeItem) {
      // Project level: show specs
      if (!this.workspaceRoot) return [];
      return element.project.specs.map(spec => 
        new SpecTreeItem(spec, element.project.name, this.workspaceRoot!, this.cache)
      );
    }

    return [];
  }

  getProjects(): ProjectWithSpecs[] {
    return this.projects;
  }

  getWorkspaceRoot(): string | undefined {
    return this.workspaceRoot;
  }
}
