import crypto from "node:crypto";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";

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

interface CacheFileV1 {
  version: 1;
  workspaceRoot: string;
  updatedAtIso: string;
  specs: Record<string, SpecRunMetrics>;
}

const CACHE_VERSION = 1 as const;

function xdgCacheHome(): string {
  return process.env.XDG_CACHE_HOME ?? path.join(os.homedir(), ".cache");
}

function workspaceId(workspaceRoot: string): string {
  return crypto
    .createHash("sha256")
    .update(workspaceRoot)
    .digest("hex")
    .slice(0, 16);
}

function normalizeRelPath(relPath: string): string {
  return relPath.split(path.sep).join("/");
}

async function ensureDir(p: string): Promise<void> {
  await fs.mkdir(p, { recursive: true });
}

async function pathExists(p: string): Promise<boolean> {
  try {
    await fs.access(p);
    return true;
  } catch {
    return false;
  }
}

export class SpecRunCache {
  private filePath: string;
  private workspaceRoot: string;
  private specs: Record<string, SpecRunMetrics> = {};
  private lastUpdatedIso?: string;

  constructor(workspaceRoot: string) {
    this.workspaceRoot = workspaceRoot;
    const dir = path.join(xdgCacheHome(), "nx-test-ui");
    const id = workspaceId(workspaceRoot);
    this.filePath = path.join(dir, `cache-${id}.json`);
  }

  getCacheFilePath(): string {
    return this.filePath;
  }

  get(relSpecPathFromWorkspace: string): SpecRunMetrics | undefined {
    const key = normalizeRelPath(relSpecPathFromWorkspace);
    return this.specs[key];
  }

  set(relSpecPathFromWorkspace: string, metrics: SpecRunMetrics): void {
    const key = normalizeRelPath(relSpecPathFromWorkspace);
    this.specs[key] = metrics;
  }

  setMany(relSpecPathsFromWorkspace: string[], metrics: SpecRunMetrics): void {
    for (const p of relSpecPathsFromWorkspace) {
      this.set(p, metrics);
    }
  }

  async load(): Promise<void> {
    if (!(await pathExists(this.filePath))) {
      this.specs = {};
      this.lastUpdatedIso = undefined;
      return;
    }
    try {
      const raw = await fs.readFile(this.filePath, "utf8");
      const parsed = JSON.parse(raw) as Partial<CacheFileV1>;
      if (parsed.version !== CACHE_VERSION) {
        this.specs = {};
        this.lastUpdatedIso = undefined;
        return;
      }
      if (parsed.workspaceRoot !== this.workspaceRoot) {
        this.specs = {};
        this.lastUpdatedIso = undefined;
        return;
      }
      this.specs = (parsed.specs ?? {}) as Record<string, SpecRunMetrics>;
      this.lastUpdatedIso = parsed.updatedAtIso;
    } catch (err) {
      this.specs = {};
      this.lastUpdatedIso = undefined;
      try {
        await fs.unlink(this.filePath);
      } catch {
        // ignore
      }
      console.warn(
        `[nx-test-ui] Failed to read cache ${this.filePath}:`,
        err instanceof Error ? err.message : err
      );
    }
  }

  async save(): Promise<void> {
    await ensureDir(path.dirname(this.filePath));
    const data: CacheFileV1 = {
      version: CACHE_VERSION,
      workspaceRoot: this.workspaceRoot,
      updatedAtIso: new Date().toISOString(),
      specs: this.specs,
    };
    this.lastUpdatedIso = data.updatedAtIso;
    await fs.writeFile(
      this.filePath,
      JSON.stringify(data, null, 2) + "\n",
      "utf8"
    );
  }

  getStats(): { entries: number; updatedAtIso?: string } {
    return {
      entries: Object.keys(this.specs).length,
      updatedAtIso: this.lastUpdatedIso,
    };
  }
}
