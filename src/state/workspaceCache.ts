import * as vscode from 'vscode';

export interface JestTestCounts {
  passed?: number;
  failed?: number;
  skipped?: number;
  total?: number;
}

export interface SpecRunMetrics {
  lastRunIso: string;
  exitCode: number;
  durationMs: number;
  jest?: JestTestCounts;
}

/**
 * Adapts the file-based SpecRunCache to VS Code's workspaceState API.
 * All cache data is stored in VS Code's extension storage.
 * 
 * This replaces the original services/cache/specRunCache.ts which used
 * file system storage at ~/.et-test-runner-cache/.
 */
export class WorkspaceCache {
  private static readonly CACHE_KEY = 'et-test-runner.specCache';

  constructor(private context: vscode.ExtensionContext) {}

  private normalizeRelPath(relPath: string): string {
    return relPath.split('\\').join('/');
  }

  get(relSpecPathFromWorkspace: string): SpecRunMetrics | undefined {
    const cache = this.context.workspaceState.get<Record<string, SpecRunMetrics>>(
      WorkspaceCache.CACHE_KEY,
      {}
    );
    const key = this.normalizeRelPath(relSpecPathFromWorkspace);
    return cache[key];
  }

  async set(relSpecPathFromWorkspace: string, metrics: SpecRunMetrics): Promise<void> {
    const cache = this.context.workspaceState.get<Record<string, SpecRunMetrics>>(
      WorkspaceCache.CACHE_KEY,
      {}
    );
    const key = this.normalizeRelPath(relSpecPathFromWorkspace);
    cache[key] = metrics;
    await this.context.workspaceState.update(WorkspaceCache.CACHE_KEY, cache);
  }

  async setMany(relSpecPathsFromWorkspace: string[], metrics: SpecRunMetrics): Promise<void> {
    const cache = this.context.workspaceState.get<Record<string, SpecRunMetrics>>(
      WorkspaceCache.CACHE_KEY,
      {}
    );
    for (const p of relSpecPathsFromWorkspace) {
      const key = this.normalizeRelPath(p);
      cache[key] = metrics;
    }
    await this.context.workspaceState.update(WorkspaceCache.CACHE_KEY, cache);
  }

  async clear(): Promise<void> {
    await this.context.workspaceState.update(WorkspaceCache.CACHE_KEY, {});
  }

  getAll(): Record<string, SpecRunMetrics> {
    return this.context.workspaceState.get<Record<string, SpecRunMetrics>>(
      WorkspaceCache.CACHE_KEY,
      {}
    );
  }

  /**
   * Get cache statistics (for display/debugging purposes)
   */
  getStats(): { entryCount: number; lastUpdated: string | null } {
    const cache = this.getAll();
    const entries = Object.values(cache);
    
    let lastUpdated: string | null = null;
    if (entries.length > 0) {
      const sortedByDate = entries.sort((a, b) => 
        new Date(b.lastRunIso).getTime() - new Date(a.lastRunIso).getTime()
      );
      lastUpdated = sortedByDate[0].lastRunIso;
    }

    return {
      entryCount: entries.length,
      lastUpdated
    };
  }
}
