import type { ProjectWithSpecs, SpecEntry, MissingSpecEntry } from './model.js';

// ============================================================================
// WebView -> Extension Messages
// ============================================================================

export type WebViewMessage =
  | { type: 'ready' }
  | { type: 'selectProject'; payload: { projectName: string } }
  | { type: 'toggleSpec'; payload: { specPath: string } }
  | { type: 'selectAllSpecs' }
  | { type: 'clearSelection' }
  | { type: 'runSpecs'; payload: { specPaths: string[] } }
  | { type: 'runProject'; payload: { projectName: string } }
  | { type: 'runAllChanged' }
  | { type: 'rerunFailed' }
  | { type: 'cancelRun' }
  | { type: 'refresh' }
  | { type: 'aiAssist'; payload: { specPath: string; action: 'fix' | 'write' | 'refactor'; target?: 'cursor' | 'copilot' } }
  | { type: 'createSpec'; payload: { missingSpecPath: string; sourcePath: string } }
  | { type: 'search'; payload: { query: string } }
  | { type: 'toggleLogs' }
  | { type: 'pinSpec'; payload: { specPath: string } }
  | { type: 'unpinSpec'; payload: { specPath: string } }
  | { type: 'openFile'; payload: { filePath: string; line?: number; column?: number; searchText?: string } }
  | { type: 'copyToClipboard'; payload: { text: string } };

// ============================================================================
// Extension -> WebView Messages
// ============================================================================

export interface SpecMetrics {
  passed: number;
  failed: number;
  skipped: number;
  total: number;
  durationMs: number;
  lastRunIso?: string;
}

export interface ProjectState {
  name: string;
  runner: string;
  rootAbs: string;
  specs: SpecState[];
  missingSpecs: MissingSpecState[];
  metrics?: ProjectMetrics;
}

export interface CoverageMetrics {
  statements?: number;
  functions?: number;
  branches?: number;
  lines?: number;
}

export interface ProjectMetrics {
  passed: number;
  failed: number;
  skipped: number;
  total: number;
  durationMs: number;
  coveragePercent?: number;
  coverage?: CoverageMetrics;
}

export interface SpecState {
  absPath: string;
  relPath: string;
  libRelPath: string;  // Path relative to lib/project root
  fileName: string;
  status: 'U' | 'S' | 'C' | 'R'; // Unstaged, Staged, Committed, Regular
  testStatus: 'pass' | 'fail' | 'pending' | 'running' | 'queued';
  selected: boolean;
  pinned: boolean;
  metrics?: SpecMetrics;
  failurePreview?: FailurePreview[];
  // Performance tracking
  isSlow?: boolean;        // Duration > 5s
  isFlaky?: boolean;       // Inconsistent pass/fail
  averageDurationMs?: number;
  durationTrend?: 'faster' | 'slower' | 'stable';
}

export interface FailurePreview {
  testName: string;
  errorMessage: string;
  line?: number;
}

export interface MissingSpecState {
  expectedSpecPath: string;
  sourcePath: string;
  sourceStatus: 'U' | 'S' | 'C';
}

export interface LogEntry {
  timestamp: string;
  level: 'info' | 'debug' | 'warn' | 'error' | 'action';
  message: string;
}

export interface UIState {
  selectedProjectName: string | null;
  selectedSpecPaths: Set<string>;
  pinnedSpecPaths: Set<string>;
  searchQuery: string;
  logsVisible: boolean;
  focusedPane: 'projects' | 'specs' | 'output' | 'logs';
}

export interface RunningState {
  isRunning: boolean;
  projectName?: string;
  specPaths?: string[];
  progress?: {
    completed: number;
    total: number;
    currentSpec?: string;
  };
}

export type ExtensionMessage =
  | { type: 'initialize'; payload: InitializePayload }
  | { type: 'updateProjects'; payload: { projects: ProjectState[]; branch?: string; workspacePath?: string } }
  | { type: 'updateSpecs'; payload: { specs: SpecState[]; missingSpecs: MissingSpecState[] } }
  | { type: 'updateOutput'; payload: { content: string; append: boolean } }
  | { type: 'updateLogs'; payload: { entries: LogEntry[] } }
  | { type: 'addLog'; payload: LogEntry }
  | { type: 'updateProgress'; payload: RunningState }
  | { type: 'updateRunningState'; payload: RunningState }
  | { type: 'updateUIState'; payload: Partial<UIState> }
  | { type: 'showNotification'; payload: { message: string; type: 'info' | 'warning' | 'error' } }
  | { type: 'showLoader'; payload?: { text?: string } }
  | { type: 'hideLoader' };

export interface InitializePayload {
  projects: ProjectState[];
  uiState: UIState;
  runningState: RunningState;
  logs: LogEntry[];
  config: {
    baseRef: string;
    branch: string;
    workspacePath: string;
  };
}

