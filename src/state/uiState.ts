import * as vscode from 'vscode';
import type { UIState, LogEntry } from '../types/webview.js';

/**
 * Manages UI state that persists across sessions.
 * Stored in VS Code's workspaceState.
 */
interface PerformanceData {
  durations: number[];
  results: ('pass' | 'fail')[];
}

export class UIStateManager {
  private static readonly PINNED_KEY = 'et-test-runner.pinnedSpecs';
  private static readonly UI_STATE_KEY = 'et-test-runner.uiState';
  private static readonly PERF_KEY = 'et-test-runner.performance';

  private pinnedSpecs: Set<string> = new Set();
  private logs: LogEntry[] = [];
  private uiState: UIState;
  private perfData: Map<string, PerformanceData> = new Map();

  constructor(private context: vscode.ExtensionContext) {
    this.loadState();
    this.uiState = {
      selectedProjectName: null,
      selectedSpecPaths: new Set(),
      pinnedSpecPaths: this.pinnedSpecs,
      searchQuery: '',
      logsVisible: true,
      focusedPane: 'projects'
    };
  }

  private loadState(): void {
    // Load pinned specs
    const pinnedArray = this.context.workspaceState.get<string[]>(
      UIStateManager.PINNED_KEY,
      []
    );
    this.pinnedSpecs = new Set(pinnedArray);

    // Load performance data
    const perfDataRaw = this.context.workspaceState.get<Record<string, PerformanceData>>(
      UIStateManager.PERF_KEY,
      {}
    );
    this.perfData = new Map(Object.entries(perfDataRaw));
  }

  // ========== Pinned Specs ==========

  isPinned(specPath: string): boolean {
    return this.pinnedSpecs.has(specPath);
  }

  async pinSpec(specPath: string): Promise<void> {
    this.pinnedSpecs.add(specPath);
    await this.savePinnedSpecs();
  }

  async unpinSpec(specPath: string): Promise<void> {
    this.pinnedSpecs.delete(specPath);
    await this.savePinnedSpecs();
  }

  async togglePin(specPath: string): Promise<boolean> {
    if (this.pinnedSpecs.has(specPath)) {
      this.pinnedSpecs.delete(specPath);
      await this.savePinnedSpecs();
      return false;
    } else {
      this.pinnedSpecs.add(specPath);
      await this.savePinnedSpecs();
      return true;
    }
  }

  getPinnedSpecs(): Set<string> {
    return new Set(this.pinnedSpecs);
  }

  private async savePinnedSpecs(): Promise<void> {
    await this.context.workspaceState.update(
      UIStateManager.PINNED_KEY,
      Array.from(this.pinnedSpecs)
    );
  }

  // ========== UI State ==========

  getUIState(): UIState {
    return {
      ...this.uiState,
      pinnedSpecPaths: new Set(this.pinnedSpecs),
      selectedSpecPaths: new Set(this.uiState.selectedSpecPaths)
    };
  }

  updateUIState(partial: Partial<UIState>): void {
    this.uiState = { ...this.uiState, ...partial };
  }

  setSelectedProject(projectName: string | null): void {
    this.uiState.selectedProjectName = projectName;
    this.uiState.selectedSpecPaths = new Set();
  }

  toggleSpecSelection(specPath: string): boolean {
    if (this.uiState.selectedSpecPaths.has(specPath)) {
      this.uiState.selectedSpecPaths.delete(specPath);
      return false;
    } else {
      this.uiState.selectedSpecPaths.add(specPath);
      return true;
    }
  }

  selectAllSpecs(specPaths: string[]): void {
    this.uiState.selectedSpecPaths = new Set(specPaths);
  }

  clearSelection(): void {
    this.uiState.selectedSpecPaths = new Set();
  }

  getSelectedSpecs(): string[] {
    return Array.from(this.uiState.selectedSpecPaths);
  }

  setSearchQuery(query: string): void {
    this.uiState.searchQuery = query;
  }

  toggleLogsVisible(): boolean {
    this.uiState.logsVisible = !this.uiState.logsVisible;
    return this.uiState.logsVisible;
  }

  setFocusedPane(pane: UIState['focusedPane']): void {
    this.uiState.focusedPane = pane;
  }

  // ========== Logs ==========

  addLog(level: LogEntry['level'], message: string): LogEntry {
    const entry: LogEntry = {
      timestamp: new Date().toISOString(),
      level,
      message
    };
    this.logs.push(entry);
    
    // Keep last 500 logs
    if (this.logs.length > 500) {
      this.logs = this.logs.slice(-500);
    }
    
    return entry;
  }

  getLogs(): LogEntry[] {
    return [...this.logs];
  }

  clearLogs(): void {
    this.logs = [];
  }

  // ========== Performance Tracking ==========

  async recordSpecRun(specPath: string, durationMs: number, passed: boolean): Promise<void> {
    const data = this.perfData.get(specPath) || { durations: [], results: [] };
    
    data.durations.push(durationMs);
    data.results.push(passed ? 'pass' : 'fail');
    
    // Keep last 10 runs
    if (data.durations.length > 10) {
      data.durations = data.durations.slice(-10);
      data.results = data.results.slice(-10);
    }
    
    this.perfData.set(specPath, data);
    await this.savePerfData();
  }

  getPerformanceInfo(specPath: string): {
    isSlow: boolean;
    isFlaky: boolean;
    averageDurationMs: number;
    durationTrend: 'faster' | 'slower' | 'stable';
  } | undefined {
    const data = this.perfData.get(specPath);
    if (!data || data.durations.length < 2) return undefined;

    const avgDuration = data.durations.reduce((a, b) => a + b, 0) / data.durations.length;
    const lastDuration = data.durations[data.durations.length - 1];
    const prevDuration = data.durations[data.durations.length - 2];

    // Slow: average > 5 seconds
    const isSlow = avgDuration > 5000;

    // Flaky: mixed pass/fail in recent runs (at least 2 passes and 2 fails)
    const passes = data.results.filter(r => r === 'pass').length;
    const fails = data.results.filter(r => r === 'fail').length;
    const isFlaky = passes >= 2 && fails >= 2;

    // Duration trend: compare last run to previous
    let durationTrend: 'faster' | 'slower' | 'stable' = 'stable';
    if (lastDuration > prevDuration * 1.5) {
      durationTrend = 'slower';
    } else if (lastDuration < prevDuration * 0.7) {
      durationTrend = 'faster';
    }

    return {
      isSlow,
      isFlaky,
      averageDurationMs: avgDuration,
      durationTrend
    };
  }

  private async savePerfData(): Promise<void> {
    const obj = Object.fromEntries(this.perfData);
    await this.context.workspaceState.update(UIStateManager.PERF_KEY, obj);
  }
}

