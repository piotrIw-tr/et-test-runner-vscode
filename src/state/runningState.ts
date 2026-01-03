import * as vscode from 'vscode';
import type { ExecaChildProcess } from 'execa';
import type { RunningState } from '../types/webview.js';

/**
 * Manages the state of currently running tests.
 * Tracks the running process for cancellation and progress updates.
 */
export class RunningStateManager {
  private _isRunning = false;
  private _projectName?: string;
  private _specPaths: string[] = [];
  private _runningProcess?: ExecaChildProcess;
  private _progress = { completed: 0, total: 0, currentSpec: '' };
  private _lastFailedSpecs: string[] = [];
  
  private readonly _onStateChange = new vscode.EventEmitter<RunningState>();
  readonly onStateChange = this._onStateChange.event;

  get isRunning(): boolean {
    return this._isRunning;
  }

  get projectName(): string | undefined {
    return this._projectName;
  }

  get specPaths(): string[] {
    return [...this._specPaths];
  }

  get lastFailedSpecs(): string[] {
    return [...this._lastFailedSpecs];
  }

  getState(): RunningState {
    return {
      isRunning: this._isRunning,
      projectName: this._projectName,
      specPaths: this._specPaths,
      progress: this._isRunning ? { ...this._progress } : undefined
    };
  }

  startRun(projectName: string, specPaths: string[], process?: ExecaChildProcess): void {
    this._isRunning = true;
    this._projectName = projectName;
    this._specPaths = specPaths;
    this._runningProcess = process;
    this._progress = { completed: 0, total: specPaths.length, currentSpec: specPaths[0] || '' };
    
    // Set context for keybindings
    vscode.commands.executeCommand('setContext', 'et-test-runner.isRunning', true);
    
    this._onStateChange.fire(this.getState());
  }

  updateProgress(completed: number, currentSpec?: string): void {
    this._progress.completed = completed;
    if (currentSpec) {
      this._progress.currentSpec = currentSpec;
    }
    this._onStateChange.fire(this.getState());
  }

  endRun(failedSpecs: string[] = []): void {
    this._isRunning = false;
    this._lastFailedSpecs = failedSpecs;
    this._runningProcess = undefined;
    
    // Clear context
    vscode.commands.executeCommand('setContext', 'et-test-runner.isRunning', false);
    
    this._onStateChange.fire(this.getState());
  }

  async cancel(): Promise<boolean> {
    if (!this._runningProcess) {
      return false;
    }

    try {
      // First try SIGINT (graceful)
      this._runningProcess.kill('SIGINT');
      
      // Wait a bit for graceful shutdown
      await new Promise(resolve => setTimeout(resolve, 2000));
      
      // If still running, force kill
      if (!this._runningProcess.killed) {
        this._runningProcess.kill('SIGKILL');
      }
      
      this.endRun();
      return true;
    } catch (error) {
      // Process might already be dead
      this.endRun();
      return true;
    }
  }

  setProcess(process: ExecaChildProcess): void {
    this._runningProcess = process;
  }

  dispose(): void {
    this._onStateChange.dispose();
  }
}

